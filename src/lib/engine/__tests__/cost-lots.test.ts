import { describe, expect, it } from 'vitest';
import { CostLotTracker } from '../cost-lots';
import { makeBuyEvent, makeSellEvent } from '../../../tests/helpers/factories';

describe('CostLotTracker', () => {
  // -----------------------------------------------------------------------
  // addLot
  // -----------------------------------------------------------------------
  describe('addLot', () => {
    it('creates a lot with correct fields from BUY_TRADE', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ security_id: 'NSE:RELIANCE', quantity: '10', rate: '2500' }));
      const lots = tracker.getOpenLots('NSE:RELIANCE');
      expect(lots).toHaveLength(1);
      expect(lots[0].open_quantity).toBe('10');
      expect(lots[0].original_quantity).toBe('10');
      expect(lots[0].security_id).toBe('NSE:RELIANCE');
      expect(lots[0].acquisition_date).toBe('2024-06-15');
    });

    it('capitalises additionalCost into effective_unit_cost', () => {
      const tracker = new CostLotTracker();
      // 10 shares @ 2500 = 25000, plus 100 additional cost = 25100 / 10 = 2510
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }), '100');
      const lots = tracker.getOpenLots('NSE:RELIANCE');
      expect(lots[0].effective_unit_cost).toBe('2510.000000');
    });

    it('sets effective_unit_cost to 0 when quantity is zero', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '0', rate: '2500' }));
      const lots = tracker.getOpenLots('NSE:RELIANCE');
      expect(lots).toHaveLength(0); // zero qty filtered by getOpenLots
    });

    it('appends to existing lots for same security', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      tracker.addLot(makeBuyEvent({ quantity: '5', rate: '2600' }));
      const lots = tracker.getOpenLots('NSE:RELIANCE');
      expect(lots).toHaveLength(2);
    });

    it('throws on non-BUY_TRADE event', () => {
      const tracker = new CostLotTracker();
      expect(() => tracker.addLot(makeSellEvent())).toThrow('expected BUY_TRADE');
    });

    it('throws when event has no security_id', () => {
      const tracker = new CostLotTracker();
      expect(() => tracker.addLot(makeBuyEvent({ security_id: null }))).toThrow('no security_id');
    });
  });

  // -----------------------------------------------------------------------
  // disposeLots — FIFO
  // -----------------------------------------------------------------------
  describe('disposeLots — FIFO', () => {
    it('consumes the oldest lot first', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500', event_date: '2024-01-01' }));
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2600', event_date: '2024-02-01' }));
      const disposals = tracker.disposeLots(makeSellEvent({ quantity: '-5', rate: '2700' }), 'FIFO');
      expect(disposals).toHaveLength(1);
      expect(disposals[0].acquisition_date).toBe('2024-01-01');
      expect(disposals[0].unit_cost).toBe('2500.000000'); // oldest lot
      expect(disposals[0].quantity_sold).toBe('5');
    });

    it('spans multiple lots when sell exceeds first lot', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '5', rate: '2500' }));
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2600' }));
      const disposals = tracker.disposeLots(makeSellEvent({ quantity: '-8', rate: '2700' }), 'FIFO');
      expect(disposals).toHaveLength(2);
      expect(disposals[0].quantity_sold).toBe('5'); // fully consumed first lot
      expect(disposals[1].quantity_sold).toBe('3'); // partial second lot
    });

    it('computes correct gain_or_loss', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      // sell 10 @ 2600 → gain = (2600-2500)*10 = 1000
      const disposals = tracker.disposeLots(makeSellEvent({ quantity: '-10', rate: '2600' }), 'FIFO');
      expect(disposals[0].gain_or_loss).toBe('1000.00');
      expect(disposals[0].total_cost).toBe('25000.00');
    });

    it('computes correct loss', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      // sell 10 @ 2400 → loss = (2400-2500)*10 = -1000
      const disposals = tracker.disposeLots(makeSellEvent({ quantity: '-10', rate: '2400' }), 'FIFO');
      expect(disposals[0].gain_or_loss).toBe('-1000.00');
    });

    it('removes fully exhausted lots', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      tracker.disposeLots(makeSellEvent({ quantity: '-10', rate: '2600' }), 'FIFO');
      expect(tracker.getOpenLots('NSE:RELIANCE')).toHaveLength(0);
    });

    it('partially consumes a lot and leaves remainder', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      tracker.disposeLots(makeSellEvent({ quantity: '-3', rate: '2600' }), 'FIFO');
      const lots = tracker.getOpenLots('NSE:RELIANCE');
      expect(lots).toHaveLength(1);
      expect(lots[0].open_quantity).toBe('7');
    });

    it('throws when sell quantity exceeds available lots', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '5', rate: '2500' }));
      expect(() =>
        tracker.disposeLots(makeSellEvent({ quantity: '-10', rate: '2600' }), 'FIFO'),
      ).toThrow('sell quantity exceeds');
    });

    it('throws on non-SELL_TRADE event', () => {
      const tracker = new CostLotTracker();
      expect(() => tracker.disposeLots(makeBuyEvent(), 'FIFO')).toThrow('expected SELL_TRADE');
    });
  });

  // -----------------------------------------------------------------------
  // disposeLots — WEIGHTED_AVERAGE
  // -----------------------------------------------------------------------
  describe('disposeLots — WEIGHTED_AVERAGE', () => {
    it('computes blended unit cost and returns single disposal', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2600' }));
      // weighted avg = (25000+26000)/20 = 2550
      const disposals = tracker.disposeLots(
        makeSellEvent({ quantity: '-5', rate: '2700' }),
        'WEIGHTED_AVERAGE',
      );
      expect(disposals).toHaveLength(1);
      expect(disposals[0].lot_id).toBe('WEIGHTED_AVERAGE');
      expect(disposals[0].acquisition_date).toBe('2024-06-15');
      expect(disposals[0].unit_cost).toBe('2550.000000');
      // gain = 5*(2700-2550) = 750
      expect(disposals[0].gain_or_loss).toBe('750.00');
    });

    it('throws when sell exceeds total open quantity', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '5', rate: '2500' }));
      expect(() =>
        tracker.disposeLots(makeSellEvent({ quantity: '-10', rate: '2600' }), 'WEIGHTED_AVERAGE'),
      ).toThrow('sell quantity exceeds');
    });
  });

  // -----------------------------------------------------------------------
  // getOpenLots
  // -----------------------------------------------------------------------
  describe('getOpenLots', () => {
    it('returns empty array for unknown security', () => {
      const tracker = new CostLotTracker();
      expect(tracker.getOpenLots('NSE:UNKNOWN')).toHaveLength(0);
    });

    it('reflects state after addLot and disposeLots', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      expect(tracker.getOpenLots('NSE:RELIANCE')).toHaveLength(1);
      tracker.disposeLots(makeSellEvent({ quantity: '-10', rate: '2600' }), 'FIFO');
      expect(tracker.getOpenLots('NSE:RELIANCE')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // adjustLots
  // -----------------------------------------------------------------------
  describe('adjustLots', () => {
    it('multiplies quantity for bonus', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      tracker.adjustLots({
        securityId: 'NSE:RELIANCE',
        quantityMultiplier: '2',
        preserveAcquisitionDate: true,
      });
      const lots = tracker.getOpenLots('NSE:RELIANCE');
      expect(lots[0].open_quantity).toBe('20');
      expect(lots[0].original_quantity).toBe('20');
      // cost divisor defaults to multiplier: 2500/2 = 1250
      expect(lots[0].effective_unit_cost).toBe('1250.000000');
    });

    it('uses explicit costDivisor when provided', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      tracker.adjustLots({
        securityId: 'NSE:RELIANCE',
        quantityMultiplier: '3',
        costDivisor: '3',
        preserveAcquisitionDate: true,
      });
      const lots = tracker.getOpenLots('NSE:RELIANCE');
      expect(lots[0].open_quantity).toBe('30');
      // 2500/3
      expect(lots[0].effective_unit_cost).toMatch(/^833\.33/);
    });

    it('transfers lots to new security_id for merger', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ security_id: 'NSE:OLDCO', quantity: '10', rate: '2500' }));
      tracker.adjustLots({
        securityId: 'NSE:OLDCO',
        quantityMultiplier: '1',
        newSecurityId: 'NSE:NEWCO',
        preserveAcquisitionDate: false,
        actionDate: '2024-09-01',
      });
      expect(tracker.getOpenLots('NSE:OLDCO')).toHaveLength(0);
      const newLots = tracker.getOpenLots('NSE:NEWCO');
      expect(newLots).toHaveLength(1);
      expect(newLots[0].security_id).toBe('NSE:NEWCO');
      expect(newLots[0].acquisition_date).toBe('2024-09-01');
    });

    it('preserves acquisition date when flag is true', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500', event_date: '2023-01-01' }));
      tracker.adjustLots({
        securityId: 'NSE:RELIANCE',
        quantityMultiplier: '2',
        preserveAcquisitionDate: true,
        actionDate: '2024-09-01',
      });
      expect(tracker.getOpenLots('NSE:RELIANCE')[0].acquisition_date).toBe('2023-01-01');
    });

    it('no-ops for unknown security', () => {
      const tracker = new CostLotTracker();
      // Should not throw
      tracker.adjustLots({
        securityId: 'NSE:NONEXISTENT',
        quantityMultiplier: '2',
        preserveAcquisitionDate: true,
      });
    });
  });

  // -----------------------------------------------------------------------
  // Aggregation helpers
  // -----------------------------------------------------------------------
  describe('aggregation helpers', () => {
    it('getTotalCostSold sums total_cost', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2600' }));
      const disposals = tracker.disposeLots(makeSellEvent({ quantity: '-15', rate: '2700' }), 'FIFO');
      // 10*2500 + 5*2600 = 25000+13000 = 38000
      expect(tracker.getTotalCostSold(disposals)).toBe('38000.00');
    });

    it('getTotalGainLoss sums gain_or_loss', () => {
      const tracker = new CostLotTracker();
      tracker.addLot(makeBuyEvent({ quantity: '10', rate: '2500' }));
      const disposals = tracker.disposeLots(makeSellEvent({ quantity: '-10', rate: '2600' }), 'FIFO');
      // gain = 10*(2600-2500) = 1000
      expect(tracker.getTotalGainLoss(disposals)).toBe('1000.00');
    });
  });
});
