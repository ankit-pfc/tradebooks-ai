import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  buildBuyVoucher,
  buildSellVoucher,
  buildSettlementVoucher,
  buildDividendVoucher,
  buildCorporateActionVoucher,
} from '../voucher-builder';
import { INVESTOR_DEFAULT, TRADER_DEFAULT } from '../accounting-policy';
import { EventType } from '../../types/events';
import { VoucherType } from '../../types/vouchers';
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

  it('voucher is balanced and has PURCHASE type', () => {
    const event = makeBuyEvent({ gross_amount: '25000.00' });
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, []);
    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.voucher_type).toBe(VoucherType.PURCHASE);
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

// ---------------------------------------------------------------------------
// buildSellVoucher
// ---------------------------------------------------------------------------
describe('buildSellVoucher — investor', () => {
  const costDisposals = [{
    lot_id: 'lot-1',
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
    expect(voucher.voucher_type).toBe(VoucherType.SALES);
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
