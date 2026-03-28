import { describe, expect, it } from 'vitest';
import { CostLotTracker } from '../cost-lots';
import { EventType, type CanonicalEvent } from '../../types/events';

function makeBuyEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: crypto.randomUUID(),
    import_batch_id: 'batch-1',
    event_type: EventType.BUY_TRADE,
    event_date: '2024-06-15',
    settlement_date: null,
    security_id: 'RELIANCE',
    quantity: '10',
    rate: '2500.00',
    gross_amount: '25000.00',
    charge_type: null,
    charge_amount: '0',
    source_file_id: 'file-1',
    source_row_ids: ['r1'],
    contract_note_ref: null,
    external_ref: null,
    event_hash: 'hash1',
    ...overrides,
  };
}

function makeSellEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    ...makeBuyEvent(),
    event_type: EventType.SELL_TRADE,
    quantity: '-5',
    rate: '2600.00',
    gross_amount: '13000.00',
    event_id: crypto.randomUUID(),
    ...overrides,
  };
}

describe('CostLotTracker serialization', () => {
  it('toJSON / fromJSON round-trips with open lots', () => {
    const tracker = new CostLotTracker();
    tracker.addLot(makeBuyEvent({ security_id: 'RELIANCE', quantity: '10', rate: '2500' }));
    tracker.addLot(makeBuyEvent({ security_id: 'TCS', quantity: '5', rate: '3500' }));

    const json = tracker.toJSON();
    expect(Object.keys(json.lots)).toHaveLength(2);
    expect(json.lots['RELIANCE']).toHaveLength(1);
    expect(json.lots['TCS']).toHaveLength(1);

    const restored = CostLotTracker.fromJSON(json);
    const relianceLots = restored.getOpenLots('RELIANCE');
    expect(relianceLots).toHaveLength(1);
    expect(relianceLots[0].open_quantity).toBe('10');
    expect(relianceLots[0].effective_unit_cost).toBe('2500.000000');

    const tcsLots = restored.getOpenLots('TCS');
    expect(tcsLots).toHaveLength(1);
    expect(tcsLots[0].open_quantity).toBe('5');
  });

  it('round-trips correctly after partial disposal', () => {
    const tracker = new CostLotTracker();
    tracker.addLot(makeBuyEvent({ security_id: 'RELIANCE', quantity: '10', rate: '2500' }));
    tracker.disposeLots(
      makeSellEvent({ security_id: 'RELIANCE', quantity: '-3', rate: '2600' }),
      'FIFO',
    );

    const json = tracker.toJSON();
    expect(json.lots['RELIANCE']).toHaveLength(1);
    expect(json.lots['RELIANCE'][0].open_quantity).toBe('7');

    const restored = CostLotTracker.fromJSON(json);
    const lots = restored.getOpenLots('RELIANCE');
    expect(lots).toHaveLength(1);
    expect(lots[0].open_quantity).toBe('7');

    // Can continue selling from restored tracker
    const disposals = restored.disposeLots(
      makeSellEvent({ security_id: 'RELIANCE', quantity: '-2', rate: '2700' }),
      'FIFO',
    );
    expect(disposals).toHaveLength(1);
    expect(disposals[0].quantity_sold).toBe('2');
    expect(restored.getOpenLots('RELIANCE')[0].open_quantity).toBe('5');
  });

  it('empty tracker serializes and restores correctly', () => {
    const tracker = new CostLotTracker();
    const json = tracker.toJSON();
    expect(Object.keys(json.lots)).toHaveLength(0);

    const restored = CostLotTracker.fromJSON(json);
    expect(restored.getOpenLots('ANYTHING')).toHaveLength(0);
  });

  it('getAllOpenLots excludes fully consumed lots', () => {
    const tracker = new CostLotTracker();
    tracker.addLot(makeBuyEvent({ security_id: 'RELIANCE', quantity: '10', rate: '2500' }));
    tracker.disposeLots(
      makeSellEvent({ security_id: 'RELIANCE', quantity: '-10', rate: '2600' }),
      'FIFO',
    );

    const openLots = tracker.getAllOpenLots();
    expect(openLots.size).toBe(0);
  });

  it('getAllOpenLots returns multiple securities', () => {
    const tracker = new CostLotTracker();
    tracker.addLot(makeBuyEvent({ security_id: 'RELIANCE', quantity: '10', rate: '2500' }));
    tracker.addLot(makeBuyEvent({ security_id: 'TCS', quantity: '5', rate: '3500' }));
    tracker.addLot(makeBuyEvent({ security_id: 'INFY', quantity: '20', rate: '1500' }));

    const openLots = tracker.getAllOpenLots();
    expect(openLots.size).toBe(3);
    expect(openLots.get('RELIANCE')!.length).toBe(1);
    expect(openLots.get('TCS')!.length).toBe(1);
    expect(openLots.get('INFY')!.length).toBe(1);
  });

  it('fromJSON creates independent copy (no shared references)', () => {
    const tracker = new CostLotTracker();
    tracker.addLot(makeBuyEvent({ security_id: 'RELIANCE', quantity: '10', rate: '2500' }));

    const json = tracker.toJSON();
    const restored = CostLotTracker.fromJSON(json);

    // Mutate restored — should not affect original serialized data
    restored.disposeLots(
      makeSellEvent({ security_id: 'RELIANCE', quantity: '-5', rate: '2600' }),
      'FIFO',
    );

    expect(json.lots['RELIANCE'][0].open_quantity).toBe('10'); // unchanged
    expect(restored.getOpenLots('RELIANCE')[0].open_quantity).toBe('5');
  });

  it('preserves acquisition dates across serialization', () => {
    const tracker = new CostLotTracker();
    tracker.addLot(makeBuyEvent({
      security_id: 'RELIANCE',
      quantity: '10',
      rate: '2500',
      event_date: '2023-04-15',
    }));

    const restored = CostLotTracker.fromJSON(tracker.toJSON());
    expect(restored.getOpenLots('RELIANCE')[0].acquisition_date).toBe('2023-04-15');
  });

  it('preserves additional cost in effective_unit_cost', () => {
    const tracker = new CostLotTracker();
    tracker.addLot(
      makeBuyEvent({ security_id: 'RELIANCE', quantity: '10', rate: '2500' }),
      '100', // additional cost
    );

    const json = tracker.toJSON();
    // (2500 * 10 + 100) / 10 = 2510
    expect(json.lots['RELIANCE'][0].effective_unit_cost).toBe('2510.000000');

    const restored = CostLotTracker.fromJSON(json);
    expect(restored.getOpenLots('RELIANCE')[0].effective_unit_cost).toBe('2510.000000');
  });
});
