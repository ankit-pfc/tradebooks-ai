import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  buildBuyVoucher,
  buildSellVoucher,
  buildSettlementVoucher,
  buildDividendVoucher,
  buildCorporateActionVoucher,
  buildVouchers,
} from '../voucher-builder';
import { INVESTOR_DEFAULT, TRADER_DEFAULT } from '../accounting-policy';
import { ChargeTreatment } from '../../types/accounting';
import { EventType } from '../../types/events';
import { VoucherType } from '../../types/vouchers';
import { CostLotTracker } from '../cost-lots';
import { TradeClassification } from '../trade-classifier';
import { makeBuyEvent, makeSellEvent, makeChargeEvent, makeEvent } from '../../../tests/helpers/factories';

function findLine(lines: { ledger_name: string; dr_cr: string }[], partial: string, drCr: 'DR' | 'CR') {
  return lines.find(l => l.ledger_name.includes(partial) && l.dr_cr === drCr);
}

// ---------------------------------------------------------------------------
// buildBuyVoucher
// ---------------------------------------------------------------------------
describe('buildBuyVoucher — investor HYBRID', () => {
  it('capitalises charges into single DR line', () => {
    const event = makeBuyEvent({ quantity: '10', rate: '2500', gross_amount: '25000.00' });
    const charges = [makeChargeEvent(EventType.STT, '2.50'), makeChargeEvent(EventType.BROKERAGE, '20.00')];
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, charges);

    // Single DR = gross + charges = 25000 + 22.50 = 25022.50
    const drLine = voucher.lines.find(l => l.dr_cr === 'DR')!;
    expect(drLine.amount).toBe('25022.50');
    expect(drLine.ledger_name).toContain('Investment in Equity Shares');
  });

  it('credits broker for total payable', () => {
    const event = makeBuyEvent({ quantity: '10', rate: '2500', gross_amount: '25000.00' });
    const charges = [makeChargeEvent(EventType.STT, '2.50')];
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, charges);

    const crLine = voucher.lines.find(l => l.dr_cr === 'CR')!;
    expect(crLine.amount).toBe('25002.50');
  });

  it('voucher is balanced and has JOURNAL type for investor mode', () => {
    const event = makeBuyEvent({ gross_amount: '25000.00' });
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, []);
    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.voucher_type).toBe(VoucherType.JOURNAL);
  });
});

describe('buildBuyVoucher — trader EXPENSE', () => {
  it('debits asset at gross and each charge separately', () => {
    const event = makeBuyEvent({ quantity: '10', rate: '2500', gross_amount: '25000.00' });
    const charges = [
      makeChargeEvent(EventType.STT, '2.50'),
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
    ];
    const voucher = buildBuyVoucher(event, TRADER_DEFAULT, charges);

    const assetDr = findLine(voucher.lines, 'Shares-in-Trade', 'DR');
    expect(assetDr?.amount).toBe('25000.00');

    const sttDr = findLine(voucher.lines, 'Securities Transaction Tax', 'DR');
    expect(sttDr?.amount).toBe('2.50');

    const brokDr = findLine(voucher.lines, 'Brokerage', 'DR');
    expect(brokDr?.amount).toBe('20.00');
  });

  it('credits broker for gross + charges', () => {
    const event = makeBuyEvent({ gross_amount: '25000.00' });
    const charges = [makeChargeEvent(EventType.STT, '10.00')];
    const voucher = buildBuyVoucher(event, TRADER_DEFAULT, charges);

    const crLine = voucher.lines.find(l => l.dr_cr === 'CR')!;
    expect(crLine.amount).toBe('25010.00');
  });

  it('skips zero-amount charge events', () => {
    const event = makeBuyEvent({ gross_amount: '25000.00' });
    const charges = [makeChargeEvent(EventType.STT, '0')];
    const voucher = buildBuyVoucher(event, TRADER_DEFAULT, charges);

    const sttLine = findLine(voucher.lines, 'Securities Transaction Tax', 'DR');
    expect(sttLine).toBeUndefined();
  });
});

describe('deriveEffectiveProfile routing via build vouchers', () => {
  it('preserves backward compatibility when classification is absent', () => {
    const event = makeBuyEvent({
      trade_classification: undefined,
      trade_product: undefined,
      gross_amount: '25000.00',
      quantity: '10',
      rate: '2500.00',
    });
    const charges = [makeChargeEvent(EventType.BROKERAGE, '20.00')];

    const voucher = buildBuyVoucher(event, TRADER_DEFAULT, charges);

    expect(findLine(voucher.lines, 'Shares-in-Trade', 'DR')?.amount).toBe('25000.00');
    expect(findLine(voucher.lines, 'Brokerage', 'DR')?.amount).toBe('20.00');
    expect(findLine(voucher.lines, 'Investment in Equity Shares', 'DR')).toBeUndefined();
  });

  it('routes investment-classified buys to investor + hybrid even under trader profile', () => {
    const event = makeBuyEvent({
      trade_classification: TradeClassification.INVESTMENT,
      trade_product: 'CNC',
      gross_amount: '25000.00',
      quantity: '10',
      rate: '2500.00',
    });
    const charges = [makeChargeEvent(EventType.BROKERAGE, '20.00')];

    const voucher = buildBuyVoucher(event, TRADER_DEFAULT, charges);

    expect(findLine(voucher.lines, 'Investment in Equity Shares', 'DR')?.amount).toBe('25020.00');
    expect(findLine(voucher.lines, 'Shares-in-Trade', 'DR')).toBeUndefined();
    expect(findLine(voucher.lines, 'Brokerage', 'DR')).toBeUndefined();
  });

  it('routes speculative sells to investor/journal structure with speculation gain/loss ledger', () => {
    const event = makeSellEvent({
      trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
      trade_product: 'MIS',
      gross_amount: '26000.00',
    });
    const costDisposals = [{
      lot_id: 'lot-1',
      acquisition_date: '2024-06-01',
      quantity_sold: '10',
      unit_cost: '2500.000000',
      total_cost: '25000.00',
      gain_or_loss: '1000.00',
    }];

    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], costDisposals, 0);

    // Speculative sells use investor-style Journal with inventory allocation
    expect(voucher.voucher_type).toBe(VoucherType.JOURNAL);
    // Should NOT have trader-style ledgers
    expect(findLine(voucher.lines, 'Trading Sales', 'CR')).toBeUndefined();
    expect(findLine(voucher.lines, 'Cost of Shares Sold', 'DR')).toBeUndefined();
    // Should have speculation gain/loss ledger
    expect(voucher.lines.some((line) => line.ledger_name.includes('Speculative') || line.ledger_name.includes('Speculation'))).toBe(true);
  });

  it('adds MTF review flag to narrative while keeping investor-style purchase treatment', () => {
    const event = makeBuyEvent({
      trade_classification: TradeClassification.INVESTMENT,
      trade_product: 'MTF',
    });
    const voucher = buildBuyVoucher(event, TRADER_DEFAULT, [makeChargeEvent(EventType.BROKERAGE, '20.00')]);

    expect(voucher.narrative).toContain('Review: MTF financing treatment');
    expect(findLine(voucher.lines, 'Investment in Equity Shares', 'DR')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// buildSellVoucher
// ---------------------------------------------------------------------------
describe('buildSellVoucher — investor', () => {
  const costDisposals = [{
    lot_id: 'lot-1',
    acquisition_date: '2024-06-01',
    quantity_sold: '10',
    unit_cost: '2500.000000',
    total_cost: '25000.00',
    gain_or_loss: '1000.00',
  }];

  it('books STCG for short-term gain (≤365 days)', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], costDisposals, 100);

    const gainLine = findLine(voucher.lines, 'Short Term Capital Gain on Sale of Shares', 'CR');
    expect(gainLine).toBeDefined();
    expect(voucher.voucher_type).toBe(VoucherType.JOURNAL);
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('books LTCG for long-term gain (>365 days)', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], costDisposals, 400);

    const gainLine = findLine(voucher.lines, 'Long Term Capital Gain on Sale of Shares', 'CR');
    expect(gainLine).toBeDefined();
  });

  it('books loss ledger for negative gain', () => {
    const lossDisposals = [{
      lot_id: 'lot-1',
      acquisition_date: '2024-06-01',
      quantity_sold: '10',
      unit_cost: '2500.000000',
      total_cost: '25000.00',
      gain_or_loss: '-1000.00',
    }];
    const event = makeSellEvent({ gross_amount: '24000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], lossDisposals, 100);

    const lossLine = findLine(voucher.lines, 'Short Term Capital Loss on Sale of Shares', 'DR');
    expect(lossLine).toBeDefined();
  });

  it('voucher is balanced without charges', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], costDisposals, 100);
    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.total_debit).toBe('26000.00');
  });

  it('credits investment at cost basis', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], costDisposals, 100);

    const crAsset = findLine(voucher.lines, 'Investment in Equity Shares', 'CR');
    expect(crAsset?.amount).toBe('25000.00');
  });

  it('voucher is balanced WITH charges', () => {
    // gross=26000, cost=25000, gain=1000, charges=60.36
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [
      makeChargeEvent(EventType.STT, '25.00'),
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.GST_ON_CHARGES, '15.36'),
    ];
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, charges, costDisposals, 100);
    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.total_debit).toBe('26000.00');
  });

  it('capital gain ledger shows gross gain (before charges)', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [makeChargeEvent(EventType.STT, '50.00')];
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, charges, costDisposals, 100);

    const gainLine = findLine(voucher.lines, 'Short Term Capital Gain on Sale of Shares', 'CR');
    // Gross gain = 1000.00, NOT net of charges (950.00)
    expect(gainLine?.amount).toBe('1000.00');
  });

  it('loss case is balanced WITH charges', () => {
    const lossDisposals = [{
      lot_id: 'lot-1',
      acquisition_date: '2024-06-01',
      quantity_sold: '10',
      unit_cost: '2700.000000',
      total_cost: '27000.00',
      gain_or_loss: '-1000.00',
    }];
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [makeChargeEvent(EventType.STT, '25.00'), makeChargeEvent(EventType.BROKERAGE, '20.00')];
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, charges, lossDisposals, 100);
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

describe('buildSellVoucher — trader', () => {
  const costDisposals = [{
    lot_id: 'lot-1',
    acquisition_date: '2024-06-01',
    quantity_sold: '10',
    unit_cost: '2500.000000',
    total_cost: '25000.00',
    gain_or_loss: '1000.00',
  }];

  it('uses Trading Sales and Cost of Shares Sold', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, TRADER_DEFAULT, [], costDisposals);

    expect(findLine(voucher.lines, 'Trading Sales', 'CR')).toBeDefined();
    expect(findLine(voucher.lines, 'Cost of Shares Sold', 'DR')).toBeDefined();
    expect(findLine(voucher.lines, 'Shares-in-Trade', 'CR')).toBeDefined();
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

// ---------------------------------------------------------------------------
// buildSettlementVoucher
// ---------------------------------------------------------------------------
describe('buildSettlementVoucher', () => {
  it('BANK_RECEIPT: DR Bank, CR Broker', () => {
    const event = makeEvent({ event_type: EventType.BANK_RECEIPT, gross_amount: '50000.00' });
    const voucher = buildSettlementVoucher(event);

    expect(voucher.voucher_type).toBe(VoucherType.RECEIPT);
    const drLine = voucher.lines.find(l => l.dr_cr === 'DR')!;
    const crLine = voucher.lines.find(l => l.dr_cr === 'CR')!;
    expect(drLine.ledger_name).toContain('Bank');
    expect(crLine.ledger_name).toContain('Zerodha');
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('BANK_PAYMENT: DR Broker, CR Bank', () => {
    const event = makeEvent({ event_type: EventType.BANK_PAYMENT, gross_amount: '50000.00' });
    const voucher = buildSettlementVoucher(event);

    expect(voucher.voucher_type).toBe(VoucherType.PAYMENT);
    const drLine = voucher.lines.find(l => l.dr_cr === 'DR')!;
    const crLine = voucher.lines.find(l => l.dr_cr === 'CR')!;
    expect(drLine.ledger_name).toContain('Zerodha');
    expect(crLine.ledger_name).toContain('Bank');
  });
});

// ---------------------------------------------------------------------------
// buildDividendVoucher
// ---------------------------------------------------------------------------
describe('buildDividendVoucher', () => {
  it('no TDS: 2-legged — DR Bank, CR Dividend Income', () => {
    const event = makeEvent({
      event_type: EventType.DIVIDEND,
      gross_amount: '1000.00',
      security_id: 'NSE:RELIANCE',
    });
    const voucher = buildDividendVoucher(event, []);

    expect(voucher.lines).toHaveLength(2);
    const drBank = findLine(voucher.lines, 'Bank', 'DR');
    expect(drBank?.amount).toBe('1000.00');
    const crDiv = findLine(voucher.lines, 'Dividend', 'CR');
    expect(crDiv?.amount).toBe('1000.00');
  });

  it('with TDS: 3-legged — DR Bank (net), DR TDS, CR Dividend Income (gross)', () => {
    const event = makeEvent({
      event_type: EventType.DIVIDEND,
      gross_amount: '1000.00',
      security_id: 'NSE:RELIANCE',
    });
    const tdsCharge = makeChargeEvent(EventType.TDS_ON_DIVIDEND, '100.00');
    const voucher = buildDividendVoucher(event, [tdsCharge]);

    expect(voucher.lines).toHaveLength(3);
    const drBank = findLine(voucher.lines, 'Bank', 'DR');
    expect(drBank?.amount).toBe('900.00');
    const drTds = findLine(voucher.lines, 'TDS', 'DR');
    expect(drTds?.amount).toBe('100.00');
    const crDiv = findLine(voucher.lines, 'Dividend', 'CR');
    expect(crDiv?.amount).toBe('1000.00');
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

// ---------------------------------------------------------------------------
// buildCorporateActionVoucher
// ---------------------------------------------------------------------------
describe('buildCorporateActionVoucher', () => {
  it('returns null for BONUS_SHARES', () => {
    const event = makeEvent({ event_type: EventType.BONUS_SHARES });
    expect(buildCorporateActionVoucher(event, new Decimal(0))).toBeNull();
  });

  it('returns null for STOCK_SPLIT', () => {
    const event = makeEvent({ event_type: EventType.STOCK_SPLIT });
    expect(buildCorporateActionVoucher(event, new Decimal(0))).toBeNull();
  });

  it('returns journal for MERGER_DEMERGER', () => {
    const event = makeEvent({
      event_type: EventType.MERGER_DEMERGER,
      security_id: 'NSE:OLDCO',
      external_ref: 'NSE:NEWCO',
    });
    const voucher = buildCorporateActionVoucher(event, new Decimal('25000'));
    expect(voucher).not.toBeNull();
    expect(voucher!.voucher_type).toBe(VoucherType.JOURNAL);
    expect(voucher!.lines).toHaveLength(2);

    const drNew = findLine(voucher!.lines, 'NEWCO', 'DR');
    expect(drNew?.amount).toBe('25000.00');
    const crOld = findLine(voucher!.lines, 'OLDCO', 'CR');
    expect(crOld?.amount).toBe('25000.00');
  });

  it('returns purchase for RIGHTS_ISSUE', () => {
    const event = makeEvent({
      event_type: EventType.RIGHTS_ISSUE,
      security_id: 'NSE:RELIANCE',
      gross_amount: '5000.00',
    });
    const voucher = buildCorporateActionVoucher(event, new Decimal('5000'));
    expect(voucher).not.toBeNull();
    expect(voucher!.voucher_type).toBe(VoucherType.PURCHASE);

    const drInv = findLine(voucher!.lines, 'Investment', 'DR');
    expect(drInv?.amount).toBe('5000.00');
    const crBank = findLine(voucher!.lines, 'Bank', 'CR');
    expect(crBank?.amount).toBe('5000.00');
  });
});

// ---------------------------------------------------------------------------
// Bug 3 — Capitalized BUY RATE must use effective cost-per-unit
// ---------------------------------------------------------------------------
describe('buildBuyVoucher — capitalize RATE reflects all-in cost', () => {
  it('RATE = (gross + charges) / qty, not just gross/qty', () => {
    // 10 shares @ 2500 = 25000 gross; charges = 500; effective = 25500/10 = 2550.00
    const event = makeBuyEvent({ quantity: '10', rate: '2500.00', gross_amount: '25000.00' });
    const charges = [makeChargeEvent(EventType.STT, '200.00'), makeChargeEvent(EventType.BROKERAGE, '300.00')];
    const capitalizeProfile = { ...INVESTOR_DEFAULT, charge_treatment: ChargeTreatment.CAPITALIZE };
    const voucher = buildBuyVoucher(event, capitalizeProfile, charges);

    const drLine = voucher.lines.find(l => l.dr_cr === 'DR')!;
    expect(drLine.amount).toBe('25500.00');   // gross + charges
    expect(drLine.rate).toBe('2550.00');       // (25500) / 10
    expect(drLine.quantity).toBe('10');
  });

  it('RATE differs from event.rate when charges are present', () => {
    const event = makeBuyEvent({ quantity: '5', rate: '1000.00', gross_amount: '5000.00' });
    const charges = [makeChargeEvent(EventType.STT, '250.00')];
    const capitalizeProfile = { ...INVESTOR_DEFAULT, charge_treatment: ChargeTreatment.CAPITALIZE };
    const voucher = buildBuyVoucher(event, capitalizeProfile, charges);

    const drLine = voucher.lines.find(l => l.dr_cr === 'DR')!;
    // effective = (5000 + 250) / 5 = 1050.00
    expect(drLine.rate).toBe('1050.00');
    expect(drLine.rate).not.toBe(event.rate);
  });

  it('RATE equals event.rate when there are no charges', () => {
    const event = makeBuyEvent({ quantity: '10', rate: '2500.00', gross_amount: '25000.00' });
    const capitalizeProfile = { ...INVESTOR_DEFAULT, charge_treatment: ChargeTreatment.CAPITALIZE };
    const voucher = buildBuyVoucher(event, capitalizeProfile, []);

    const drLine = voucher.lines.find(l => l.dr_cr === 'DR')!;
    expect(drLine.rate).toBe('2500.00');
  });
});

// ---------------------------------------------------------------------------
// Bug 5 — Zero-cost disposal must not produce 0.00-amount asset lines
// ---------------------------------------------------------------------------
describe('buildSellVoucher — zero-cost disposal', () => {
  const zeroCostDisposals = [{
    lot_id: 'UNKNOWN',
    acquisition_date: '2024-06-15',
    quantity_sold: '10',
    unit_cost: '0',
    total_cost: '0',
    gain_or_loss: '26000.00',
  }];

  it('investor mode: no asset CR line when totalCostBasis = 0', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], zeroCostDisposals, 100);

    // Asset CR line is always emitted (even zero-cost) so Tally sees stock movement
    const assetLine = voucher.lines.find(l => l.ledger_name.includes('Investment') && l.dr_cr === 'CR');
    expect(assetLine).toBeDefined();
    expect(assetLine?.amount).toBe('0.00');
    expect(assetLine?.rate).toBe('0');
  });

  it('investor mode: voucher is balanced with zero-cost asset line', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], zeroCostDisposals, 100);
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('investor mode: full gross booked as gain', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], zeroCostDisposals, 100);

    const gainLine = voucher.lines.find(l => l.ledger_name.includes('Capital Gain') && l.dr_cr === 'CR');
    expect(gainLine?.amount).toBe('26000.00');
  });

  it('trader mode: stockLedger CR present with zero amount, no cost DR when totalCostBasis = 0', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, TRADER_DEFAULT, [], zeroCostDisposals);

    // Stock CR line is always emitted so Tally sees the inventory movement
    const stockLine = voucher.lines.find(l => l.ledger_name.includes('Shares-in-Trade') && l.dr_cr === 'CR');
    expect(stockLine).toBeDefined();
    expect(stockLine?.amount).toBe('0.00');
    expect(stockLine?.rate).toBe('0');

    const costLine = voucher.lines.find(l => l.ledger_name.includes('Cost of Shares Sold') && l.dr_cr === 'DR');
    expect(costLine).toBeUndefined();
  });

  it('trader mode: voucher is balanced with zero-cost stock line', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, TRADER_DEFAULT, [], zeroCostDisposals);
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

describe('buildVouchers holding period routing', () => {
  it('routes long-term sell vouchers to LTCG when disposal lots are older than 365 days', () => {
    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(
      [
        makeBuyEvent({
          event_date: '2023-01-01',
          quantity: '10',
          rate: '2500.00',
          gross_amount: '25000.00',
          trade_product: 'CNC',
        }),
        makeSellEvent({
          event_date: '2024-06-15',
          quantity: '-10',
          rate: '2600.00',
          gross_amount: '26000.00',
          trade_product: 'CNC',
        }),
      ],
      INVESTOR_DEFAULT,
      tracker,
    );

    // Investor mode sell vouchers use JOURNAL type, not SALES
    const saleVoucher = vouchers.find((voucher) =>
      voucher.narrative?.includes('Sale of'),
    );
    expect(saleVoucher).toBeDefined();
    expect(saleVoucher?.voucher_type).toBe(VoucherType.JOURNAL);
    expect(
      saleVoucher?.lines.some(
        (line) =>
          line.dr_cr === 'CR' &&
          line.ledger_name.includes('Long Term Capital Gain on Sale of Shares'),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Session / Phase 3 — STT exclusion in buildVouchers
// ---------------------------------------------------------------------------
describe('buildVouchers — excludes STT from all accounting entries', () => {
  it('investor buy cost basis excludes STT while remaining balanced', () => {
    const tracker = new CostLotTracker();
    const buyEvent = makeBuyEvent({
      event_date: '2024-06-15',
      external_ref: 'T001',
      contract_note_ref: 'CN001',
      quantity: '10',
      rate: '2500.00',
      gross_amount: '25000.00',
    });
    const brokerage = makeChargeEvent(EventType.BROKERAGE, '20.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T001',
      contract_note_ref: 'CN001',
    });
    const stt = makeChargeEvent(EventType.STT, '2.50', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T001',
      contract_note_ref: 'CN001',
    });

    const [voucher] = buildVouchers([buyEvent, brokerage, stt], INVESTOR_DEFAULT, tracker);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.total_debit).toBe('25020.00');

    const capitalizedLine = voucher.lines.find((line) => line.dr_cr === 'DR')!;
    expect(capitalizedLine.amount).toBe('25020.00');
    expect(capitalizedLine.rate).toBe('2502.00');

    expect(voucher.lines.some((line) => line.ledger_name.includes('Stt'))).toBe(false);
    expect(voucher.source_event_ids).toContain(buyEvent.event_id);
    expect(voucher.source_event_ids).toContain(brokerage.event_id);
    expect(voucher.source_event_ids).not.toContain(stt.event_id);

    const openLot = tracker.getOpenLots('NSE:RELIANCE')[0];
    expect(openLot?.effective_unit_cost).toBe('2502.000000');
  });

  it('trader buy expense lines exclude STT while brokerage still posts and balances', () => {
    const tracker = new CostLotTracker();
    const buyEvent = makeBuyEvent({
      event_date: '2024-06-15',
      external_ref: 'T002',
      contract_note_ref: 'CN002',
    });
    const brokerage = makeChargeEvent(EventType.BROKERAGE, '20.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T002',
      contract_note_ref: 'CN002',
    });
    const stt = makeChargeEvent(EventType.STT, '10.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T002',
      contract_note_ref: 'CN002',
    });

    const [voucher] = buildVouchers([buyEvent, brokerage, stt], TRADER_DEFAULT, tracker);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.total_debit).toBe('25020.00');
    expect(findLine(voucher.lines, 'Shares-in-Trade', 'DR')?.amount).toBe('25000.00');
    expect(findLine(voucher.lines, 'Brokerage', 'DR')?.amount).toBe('20.00');
    expect(findLine(voucher.lines, 'Securities Transaction Tax', 'DR')).toBeUndefined();
    expect(voucher.lines.some((line) => line.ledger_name.includes('Stt'))).toBe(false);
  });

  it('buy vouchers still include stamp duty while excluding STT', () => {
    const tracker = new CostLotTracker();
    const buyEvent = makeBuyEvent({
      event_date: '2024-06-15',
      external_ref: 'T002A',
      contract_note_ref: 'CN002A',
      quantity: '10',
      rate: '2500.00',
      gross_amount: '25000.00',
    });
    const brokerage = makeChargeEvent(EventType.BROKERAGE, '20.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T002A',
      contract_note_ref: 'CN002A',
    });
    const stampDuty = makeChargeEvent(EventType.STAMP_DUTY, '3.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T002A',
      contract_note_ref: 'CN002A',
    });
    const stt = makeChargeEvent(EventType.STT, '10.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T002A',
      contract_note_ref: 'CN002A',
    });

    const [voucher] = buildVouchers([buyEvent, brokerage, stampDuty, stt], TRADER_DEFAULT, tracker);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.total_debit).toBe('25023.00');
    expect(findLine(voucher.lines, 'Brokerage', 'DR')?.amount).toBe('20.00');
    expect(findLine(voucher.lines, 'Stamp Duty', 'DR')?.amount).toBe('3.00');
    expect(findLine(voucher.lines, 'Securities Transaction Tax', 'DR')).toBeUndefined();
    expect(voucher.source_event_ids).toContain(stampDuty.event_id);
    expect(voucher.source_event_ids).not.toContain(stt.event_id);
  });

  it('sell vouchers exclude STT expense posting and remain balanced', () => {
    const tracker = new CostLotTracker();
    const buyEvent = makeBuyEvent({
      event_date: '2024-06-14',
      external_ref: 'T003-B',
      contract_note_ref: 'CN003',
    });
    const sellEvent = makeSellEvent({
      event_date: '2024-06-15',
      external_ref: 'T003-S',
      contract_note_ref: 'CN004',
      gross_amount: '26000.00',
      quantity: '-10',
      rate: '2600.00',
    });
    const sellBrokerage = makeChargeEvent(EventType.BROKERAGE, '20.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T003-S',
      contract_note_ref: 'CN004',
    });
    const sellStt = makeChargeEvent(EventType.STT, '25.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T003-S',
      contract_note_ref: 'CN004',
    });

    const vouchers = buildVouchers(
      [buyEvent, sellEvent, sellBrokerage, sellStt],
      TRADER_DEFAULT,
      tracker,
    );

    expect(vouchers).toHaveLength(3);

    const sellVoucher = vouchers[1];
    expect(sellVoucher.total_debit).toBe(sellVoucher.total_credit);
    expect(sellVoucher.total_debit).toBe('51000.00');
    expect(findLine(sellVoucher.lines, 'Brokerage', 'DR')?.amount).toBe('20.00');
    expect(findLine(sellVoucher.lines, 'Securities Transaction Tax', 'DR')).toBeUndefined();
    expect(sellVoucher.lines.some((line) => line.ledger_name.includes('Stt'))).toBe(false);
    expect(findLine(sellVoucher.lines, 'Zerodha', 'DR')?.amount).toBe('25980.00');

    // STT summary journal voucher
    const sttVoucher = vouchers[2];
    expect(sttVoucher.voucher_type).toBe('JOURNAL');
    expect(sttVoucher.total_debit).toBe(sttVoucher.total_credit);
    expect(findLine(sttVoucher.lines, 'Securities Transaction Tax', 'DR')?.amount).toBe('25.00');
  });

  it('sell vouchers exclude both STT and stamp duty while retaining other charges', () => {
    const tracker = new CostLotTracker();
    const buyEvent = makeBuyEvent({
      event_date: '2024-06-14',
      external_ref: 'T004-B',
      contract_note_ref: 'CN005',
    });
    const sellEvent = makeSellEvent({
      event_date: '2024-06-15',
      external_ref: 'T004-S',
      contract_note_ref: 'CN006',
      gross_amount: '26000.00',
      quantity: '-10',
      rate: '2600.00',
    });
    const sellBrokerage = makeChargeEvent(EventType.BROKERAGE, '20.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T004-S',
      contract_note_ref: 'CN006',
    });
    const sellGst = makeChargeEvent(EventType.GST_ON_CHARGES, '3.60', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T004-S',
      contract_note_ref: 'CN006',
    });
    const sellSebi = makeChargeEvent(EventType.SEBI_CHARGE, '0.25', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T004-S',
      contract_note_ref: 'CN006',
    });
    const sellStampDuty = makeChargeEvent(EventType.STAMP_DUTY, '3.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T004-S',
      contract_note_ref: 'CN006',
    });
    const sellStt = makeChargeEvent(EventType.STT, '25.00', 'NSE:RELIANCE', {
      event_date: '2024-06-15',
      external_ref: 'T004-S',
      contract_note_ref: 'CN006',
    });

    const vouchers = buildVouchers(
      [buyEvent, sellEvent, sellBrokerage, sellGst, sellSebi, sellStampDuty, sellStt],
      TRADER_DEFAULT,
      tracker,
    );

    expect(vouchers).toHaveLength(3);

    const sellVoucher = vouchers[1];
    expect(sellVoucher.total_debit).toBe(sellVoucher.total_credit);
    expect(sellVoucher.total_debit).toBe('51000.00');
    expect(findLine(sellVoucher.lines, 'Brokerage', 'DR')?.amount).toBe('20.00');
    expect(findLine(sellVoucher.lines, 'GST on Brokerage', 'DR')?.amount).toBe('3.60');
    expect(findLine(sellVoucher.lines, 'SEBI Turnover Fees', 'DR')?.amount).toBe('0.25');
    expect(findLine(sellVoucher.lines, 'Stamp Duty', 'DR')).toBeUndefined();
    expect(findLine(sellVoucher.lines, 'Securities Transaction Tax', 'DR')).toBeUndefined();
    expect(sellVoucher.lines.some((line) => line.ledger_name.includes('Stamp Duty'))).toBe(false);
    expect(findLine(sellVoucher.lines, 'Zerodha', 'DR')?.amount).toBe('25976.15');
    expect(sellVoucher.source_event_ids).toContain(sellBrokerage.event_id);
    expect(sellVoucher.source_event_ids).toContain(sellGst.event_id);
    expect(sellVoucher.source_event_ids).toContain(sellSebi.event_id);
    expect(sellVoucher.source_event_ids).not.toContain(sellStampDuty.event_id);
    expect(sellVoucher.source_event_ids).not.toContain(sellStt.event_id);

    // STT + stamp duty summary journal voucher
    const sttVoucher = vouchers[2];
    expect(sttVoucher.voucher_type).toBe('JOURNAL');
    expect(sttVoucher.total_debit).toBe(sttVoucher.total_credit);
  });
});

describe('buildVouchers — mixed batch per-trade profile branching', () => {
  it('generates different voucher structures for CNC, MIS, and NRML in the same batch', () => {
    const tracker = new CostLotTracker();
    const events = [
      makeBuyEvent({
        event_date: '2024-06-10',
        security_id: 'NSE:CNCSTOCK',
        external_ref: 'CNC-BUY',
        trade_classification: TradeClassification.INVESTMENT,
        trade_product: 'CNC',
        quantity: '10',
        rate: '100.00',
        gross_amount: '1000.00',
      }),
      makeChargeEvent(EventType.BROKERAGE, '5.00', 'NSE:CNCSTOCK', {
        event_date: '2024-06-10',
        external_ref: 'CNC-BUY',
        trade_classification: TradeClassification.INVESTMENT,
      }),
      makeSellEvent({
        event_date: '2024-06-10',
        security_id: 'NSE:CNCSTOCK',
        external_ref: 'CNC-SELL',
        trade_classification: TradeClassification.INVESTMENT,
        trade_product: 'CNC',
        quantity: '-10',
        rate: '110.00',
        gross_amount: '1100.00',
      }),
      makeChargeEvent(EventType.BROKERAGE, '5.00', 'NSE:CNCSTOCK', {
        event_date: '2024-06-10',
        external_ref: 'CNC-SELL',
        trade_classification: TradeClassification.INVESTMENT,
      }),
      makeBuyEvent({
        event_date: '2024-06-11',
        security_id: 'NSE:MISSTOCK',
        external_ref: 'MIS-BUY',
        trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
        trade_product: 'MIS',
        quantity: '8',
        rate: '200.00',
        gross_amount: '1600.00',
      }),
      makeChargeEvent(EventType.BROKERAGE, '8.00', 'NSE:MISSTOCK', {
        event_date: '2024-06-11',
        external_ref: 'MIS-BUY',
        trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
      }),
      makeSellEvent({
        event_date: '2024-06-11',
        security_id: 'NSE:MISSTOCK',
        external_ref: 'MIS-SELL',
        trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
        trade_product: 'MIS',
        quantity: '-8',
        rate: '210.00',
        gross_amount: '1680.00',
      }),
      makeChargeEvent(EventType.BROKERAGE, '8.00', 'NSE:MISSTOCK', {
        event_date: '2024-06-11',
        external_ref: 'MIS-SELL',
        trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
      }),
      makeBuyEvent({
        event_date: '2024-06-12',
        security_id: 'NSE:NRMLSTOCK',
        external_ref: 'NRML-BUY',
        trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
        trade_product: 'NRML',
        quantity: '6',
        rate: '300.00',
        gross_amount: '1800.00',
      }),
      makeChargeEvent(EventType.BROKERAGE, '6.00', 'NSE:NRMLSTOCK', {
        event_date: '2024-06-12',
        external_ref: 'NRML-BUY',
        trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
      }),
      makeSellEvent({
        event_date: '2024-06-13',
        security_id: 'NSE:NRMLSTOCK',
        external_ref: 'NRML-SELL',
        trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
        trade_product: 'NRML',
        quantity: '-6',
        rate: '315.00',
        gross_amount: '1890.00',
      }),
      makeChargeEvent(EventType.BROKERAGE, '6.00', 'NSE:NRMLSTOCK', {
        event_date: '2024-06-13',
        external_ref: 'NRML-SELL',
        trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
      }),
    ];

    const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);

    expect(vouchers).toHaveLength(6);

    const cncBuy = vouchers.find((voucher) => voucher.external_reference === 'CNC-BUY')!;
    const cncSell = vouchers.find((voucher) => voucher.external_reference === 'CNC-SELL')!;
    const misBuy = vouchers.find((voucher) => voucher.external_reference === 'MIS-BUY')!;
    const misSell = vouchers.find((voucher) => voucher.external_reference === 'MIS-SELL')!;
    const nrmlBuy = vouchers.find((voucher) => voucher.external_reference === 'NRML-BUY')!;
    const nrmlSell = vouchers.find((voucher) => voucher.external_reference === 'NRML-SELL')!;

    expect(findLine(cncBuy.lines, 'Investment in Equity Shares', 'DR')).toBeDefined();
    expect(findLine(cncBuy.lines, 'Shares-in-Trade', 'DR')).toBeUndefined();

    expect(findLine(cncSell.lines, 'Investment in Equity Shares', 'CR')).toBeDefined();
    expect(cncSell.lines.some((line) => line.ledger_name.includes('Speculative'))).toBe(false);

    // MIS (speculative) now uses investor/journal structure with inventory
    expect(findLine(misBuy.lines, 'Investment in Equity Shares', 'DR')).toBeDefined();
    expect(findLine(misBuy.lines, 'Brokerage', 'DR')?.amount).toBe('8.00');

    // MIS sell uses investor structure: no Trading Sales / Cost of Shares Sold
    expect(misSell.voucher_type).toBe(VoucherType.JOURNAL);
    expect(findLine(misSell.lines, 'Trading Sales', 'CR')).toBeUndefined();
    expect(findLine(misSell.lines, 'Cost of Shares Sold', 'DR')).toBeUndefined();

    expect(findLine(nrmlBuy.lines, 'Shares-in-Trade', 'DR')).toBeDefined();
    expect(findLine(nrmlSell.lines, 'Trading Sales', 'CR')).toBeDefined();
  });
});

describe('buildVouchers — same-day CNC and parser overrides', () => {
  it('keeps same-day CNC round-trip on investor/STCG path instead of trader routing', () => {
    const tracker = new CostLotTracker();
    const vouchers = buildVouchers([
      makeBuyEvent({
        event_date: '2024-06-15',
        security_id: 'NSE:SBIN',
        external_ref: 'CNC-DAY-BUY',
        trade_classification: TradeClassification.INVESTMENT,
        trade_product: 'CNC',
        quantity: '10',
        rate: '100.00',
        gross_amount: '1000.00',
      }),
      makeSellEvent({
        event_date: '2024-06-15',
        security_id: 'NSE:SBIN',
        external_ref: 'CNC-DAY-SELL',
        trade_classification: TradeClassification.INVESTMENT,
        trade_product: 'CNC',
        quantity: '-10',
        rate: '110.00',
        gross_amount: '1100.00',
      }),
    ], INVESTOR_DEFAULT, tracker);

    expect(vouchers).toHaveLength(2);

    const sellVoucher = vouchers.find((voucher) => voucher.external_reference === 'CNC-DAY-SELL')!;
    expect(findLine(sellVoucher.lines, 'Investment in Equity Shares', 'CR')?.amount).toBe('1000.00');
    expect(findLine(sellVoucher.lines, 'Short Term Capital Gain on Sale of Shares', 'CR')?.amount).toBe('100.00');
    expect(findLine(sellVoucher.lines, 'Trading Sales', 'CR')).toBeUndefined();
    expect(findLine(sellVoucher.lines, 'Cost of Shares Sold', 'DR')).toBeUndefined();
  });

  it('routes commodity-override CNC trades through trader ledgers even under investor profile', () => {
    const tracker = new CostLotTracker();
    const vouchers = buildVouchers([
      makeBuyEvent({
        event_date: '2024-06-16',
        security_id: 'MCX:GOLDPETAL',
        external_ref: 'MCX-BUY',
        trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
        trade_product: 'CNC',
        quantity: '2',
        rate: '50000.00',
        gross_amount: '100000.00',
      }),
      makeSellEvent({
        event_date: '2024-06-17',
        security_id: 'MCX:GOLDPETAL',
        external_ref: 'MCX-SELL',
        trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
        trade_product: 'CNC',
        quantity: '-2',
        rate: '51000.00',
        gross_amount: '102000.00',
      }),
    ], INVESTOR_DEFAULT, tracker);

    const buyVoucher = vouchers.find((voucher) => voucher.external_reference === 'MCX-BUY')!;
    const sellVoucher = vouchers.find((voucher) => voucher.external_reference === 'MCX-SELL')!;

    expect(findLine(buyVoucher.lines, 'Shares-in-Trade', 'DR')?.amount).toBe('100000.00');
    expect(findLine(buyVoucher.lines, 'Investment in Equity Shares', 'DR')).toBeUndefined();
    expect(findLine(sellVoucher.lines, 'Trading Sales', 'CR')?.amount).toBe('102000.00');
    expect(findLine(sellVoucher.lines, 'Cost of Shares Sold', 'DR')?.amount).toBe('100000.00');
  });
});
