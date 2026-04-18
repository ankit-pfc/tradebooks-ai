import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertInvestorTradeVoucherContract,
  buildBuyVoucher,
  buildSellVoucher,
  buildSettlementVoucher,
  buildDividendVoucher,
  buildCorporateActionVoucher,
  buildSttSummaryVoucher,
  buildVouchers,
  buildIntradayConsolidatedVoucher,
} from '../voucher-builder';
import { INVESTOR_DEFAULT, TRADER_DEFAULT } from '../accounting-policy';
import { isPipelineValidationError } from '../../errors/pipeline-validation';
import { ChargeTreatment } from '../../types/accounting';
import { EventType } from '../../types/events';
import { InvoiceIntent, VoucherType } from '../../types/vouchers';
import { CostLotTracker } from '../cost-lots';
import { TradeClassification, TradeClassificationStrategy } from '../trade-classifier';
import { buildCanonicalEvents, pairContractNoteData } from '../canonical-events';
import type { CostDisposal } from '../cost-lots';
import { makeBuyEvent, makeSellEvent, makeChargeEvent, makeEvent } from '../../../tests/helpers/factories';

function findLine(lines: { ledger_name: string; dr_cr: string }[], partial: string, drCr: 'DR' | 'CR') {
  return lines.find(l => l.ledger_name.includes(partial) && l.dr_cr === drCr);
}

// ---------------------------------------------------------------------------
// buildBuyVoucher
// ---------------------------------------------------------------------------
describe('buildBuyVoucher — investor HYBRID', () => {
  it('capitalises non-STT charges into the asset DR line and posts STT separately', () => {
    const event = makeBuyEvent({ quantity: '10', rate: '2500', gross_amount: '25000.00' });
    const charges = [makeChargeEvent(EventType.STT, '2.50'), makeChargeEvent(EventType.BROKERAGE, '20.00')];
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, charges);

    // Investment DR = gross + non-STT charges = 25000 + 20 = 25020.00
    // (STT is excluded from cost basis per Sec 48 and posted on its own line.)
    const assetDr = findLine(voucher.lines, 'Investment in Equity Shares', 'DR');
    expect(assetDr?.amount).toBe('25020.00');

    // STT posted as a standalone non-deductible DR line.
    const sttDr = findLine(voucher.lines, 'Securities Transaction Tax', 'DR');
    expect(sttDr?.amount).toBe('2.50');
  });

  it('credits broker for total payable (gross + ALL charges incl. STT)', () => {
    const event = makeBuyEvent({ quantity: '10', rate: '2500', gross_amount: '25000.00' });
    const charges = [makeChargeEvent(EventType.STT, '2.50')];
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, charges);

    // Broker CR = gross + capitalizable + STT = 25000 + 0 + 2.50 = 25002.50
    // Broker payable is the full out-of-pocket amount.
    const crLine = voucher.lines.find(l => l.dr_cr === 'CR')!;
    expect(crLine.amount).toBe('25002.50');
  });

  it('narration lists charge breakdown with STT as non-deductible', () => {
    const event = makeBuyEvent({ quantity: '10', rate: '2500', gross_amount: '25000.00' });
    const charges = [
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.GST_ON_CHARGES, '3.60'),
      makeChargeEvent(EventType.STT, '2.50'),
    ];
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, charges);

    expect(voucher.narrative).toContain('Purchase of RELIANCE');
    expect(voucher.narrative).toContain('brokerage 20.00');
    expect(voucher.narrative).toContain('GST 3.60');
    expect(voucher.narrative).toContain('STT 2.50 (non-deductible)');
  });

  it('voucher is balanced and uses JOURNAL type (inventory via ISINVENTORYAFFECTED on ledger master)', () => {
    const event = makeBuyEvent({ gross_amount: '25000.00' });
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, []);
    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.voucher_type).toBe(VoucherType.JOURNAL);
    // Investor mode must not tag trades with an invoice intent — the XML
    // serializer would otherwise flip VCHTYPE to "Purchase" and route the
    // voucher to Tally's Purchase register instead of the Journal register.
    expect(voucher.invoice_intent).toBe(InvoiceIntent.NONE);
  });

  it('absorbs negative contract-note charges into the capitalized asset (HYBRID/CAPITALIZE path)', () => {
    // Real Zerodha CNs occasionally emit small negative exchange-charge
    // rebates. Under HYBRID, the buy voucher capitalizes all charges into
    // a single DR asset line, so a -0.59 rebate simply lowers the asset
    // cost by 0.59 instead of failing the upload.
    const event = makeBuyEvent({ quantity: '10', rate: '2500', gross_amount: '25000.00' });
    const charges = [
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.EXCHANGE_CHARGE, '-0.59'),
    ];
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, charges);

    // Single DR = 25000 + 20.00 + (-0.59) = 25019.41
    const drLine = voucher.lines.find((l) => l.dr_cr === 'DR')!;
    expect(drLine.amount).toBe('25019.41');
    expect(drLine.ledger_name).toContain('Investment in Equity Shares');

    // CR broker mirrors the DR — voucher stays balanced
    const crLine = voucher.lines.find((l) => l.dr_cr === 'CR')!;
    expect(crLine.amount).toBe('25019.41');
    expect(voucher.total_debit).toBe(voucher.total_credit);
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

  it('posts a negative charge as a CR refund line on the same expense ledger and balances the voucher', () => {
    // Real-world: Zerodha CN with -0.59 exchange-charge rebate. Trader EXPENSE
    // path posts each charge separately, so the rebate must show up as a CR
    // on the EXCHANGE CHARGES ledger (not silently dropped) for the voucher
    // to balance against the broker line.
    const event = makeBuyEvent({ quantity: '10', rate: '2500', gross_amount: '25000.00' });
    const charges = [
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.EXCHANGE_CHARGE, '-0.59'),
    ];
    const voucher = buildBuyVoucher(event, TRADER_DEFAULT, charges);

    expect(findLine(voucher.lines, 'Shares-in-Trade', 'DR')?.amount).toBe('25000.00');
    expect(findLine(voucher.lines, 'Brokerage', 'DR')?.amount).toBe('20.00');

    const exchangeRefund = voucher.lines.find(
      (l) => l.ledger_name.includes('Exchange') && l.dr_cr === 'CR',
    );
    expect(exchangeRefund?.amount).toBe('0.59');

    // Broker payable = 25000 + 20.00 + (-0.59) = 25019.41
    const brokerCr = voucher.lines.find(
      (l) => l.dr_cr === 'CR' && !l.ledger_name.includes('Exchange'),
    );
    expect(brokerCr?.amount).toBe('25019.41');
    expect(voucher.total_debit).toBe(voucher.total_credit);
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
    // Investor-mode sells must not carry SALES intent — see buildBuyVoucher
    // comment for rationale (Journal register, not Sales register).
    expect(voucher.invoice_intent).toBe(InvoiceIntent.NONE);
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

  it('voucher is balanced WITH charges (non-STT absorbed into saleConsideration)', () => {
    // gross=26000, cost=25000, charges: STT 25, BROK 20, GST 15.36.
    // Non-STT charges (35.36) reduce saleConsideration → 25964.64.
    // Investor gain = 25964.64 - 25000 = 964.64.
    // Balance:
    //   DR broker (gross − all = 25939.64) + DR STT (25) = 25964.64
    //   CR investment (25000) + CR gain (964.64)          = 25964.64
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [
      makeChargeEvent(EventType.STT, '25.00'),
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.GST_ON_CHARGES, '15.36'),
    ];
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, charges, costDisposals, 100);
    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.total_debit).toBe('25964.64');
  });

  it('does not post brokerage / GST / exchange as separate ledger lines on investor sells', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [
      makeChargeEvent(EventType.STT, '25.00'),
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.GST_ON_CHARGES, '15.36'),
      makeChargeEvent(EventType.EXCHANGE_CHARGE, '1.50'),
    ];
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, charges, costDisposals, 100);

    // Non-STT charges are absorbed into the broker/net-cash arithmetic and
    // must NOT appear as separate expense DR lines.
    expect(findLine(voucher.lines, 'Brokerage', 'DR')).toBeUndefined();
    expect(findLine(voucher.lines, 'GST', 'DR')).toBeUndefined();
    expect(findLine(voucher.lines, 'Exchange', 'DR')).toBeUndefined();

    // STT is the lone exception — posted on its own non-deductible DR line.
    const sttDr = findLine(voucher.lines, 'Securities Transaction Tax', 'DR');
    expect(sttDr?.amount).toBe('25.00');
  });

  it('capital gain uses saleConsideration (gross − non-STT charges), STT excluded', () => {
    // gross=26000, cost=25000, STT=50 (no other charges).
    // capitalizable=0 → saleConsideration=26000 → investorGain=1000.
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [makeChargeEvent(EventType.STT, '50.00')];
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, charges, costDisposals, 100);

    const gainLine = findLine(voucher.lines, 'Short Term Capital Gain on Sale of Shares', 'CR');
    expect(gainLine?.amount).toBe('1000.00');
  });

  it('capital gain reduced by non-STT charges (saleConsideration basis)', () => {
    // gross=26000, cost=25000, brokerage=20, GST=3.60, STT=25.
    // capitalizable=23.60 → saleConsideration=25976.40 → investorGain=976.40.
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.GST_ON_CHARGES, '3.60'),
      makeChargeEvent(EventType.STT, '25.00'),
    ];
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, charges, costDisposals, 100);

    const gainLine = findLine(voucher.lines, 'Short Term Capital Gain on Sale of Shares', 'CR');
    expect(gainLine?.amount).toBe('976.40');
  });

  it('handles zero-STT sells (segment with no STT)', () => {
    // Some segments (debt) have no STT at all.
    // gross=26000, cost=25000, brokerage=20 only.
    // capitalizable=20 → saleConsideration=25980 → investorGain=980.
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [makeChargeEvent(EventType.BROKERAGE, '20.00')];
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, charges, costDisposals, 100);

    expect(findLine(voucher.lines, 'Securities Transaction Tax', 'DR')).toBeUndefined();
    const gainLine = findLine(voucher.lines, 'Short Term Capital Gain on Sale of Shares', 'CR');
    expect(gainLine?.amount).toBe('980.00');
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('loss case is balanced WITH charges', () => {
    // gross=26000, cost=27000, STT=25, BROK=20.
    // capitalizable=20 → saleConsideration=25980 → investorLoss=-1020.
    // Balance:
    //   DR broker (25955) + DR STT (25) + DR loss (1020) = 27000
    //   CR investment (27000)                            = 27000
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

    const lossLine = findLine(voucher.lines, 'Short Term Capital Loss on Sale of Shares', 'DR');
    expect(lossLine?.amount).toBe('1020.00');
  });

  it('absorbs a negative sell-side charge into saleConsideration (rebate lowers deductible charge)', () => {
    // Real FY 24-25 Zerodha CNs occasionally emit a -0.59 exchange-charge
    // rebate. In investor mode after Fix 1+2 the rebate no longer shows as a
    // separate CR line — it reduces capitalizable charges (a rebate is a
    // NEGATIVE deduction), lifting saleConsideration and the capital gain.
    // gross=26000, STT=25, exch=-0.59. capitalizable=-0.59.
    // saleConsideration = 26000 - (-0.59) = 26000.59. investorGain = 1000.59.
    //   DR broker (26000 - 24.41 = 25975.59) + DR STT (25) = 26000.59
    //   CR investment (25000) + CR gain (1000.59)          = 26000.59
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [
      makeChargeEvent(EventType.STT, '25.00'),
      makeChargeEvent(EventType.EXCHANGE_CHARGE, '-0.59'),
    ];
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, charges, costDisposals, 100);

    // The rebate is absorbed into the voucher arithmetic — no separate
    // EXCHANGE CHARGES line exists in investor mode.
    const exchangeLine = voucher.lines.find((l) => l.ledger_name.includes('Exchange'));
    expect(exchangeLine).toBeUndefined();

    // Voucher must still balance, and the gain ledger reflects the lift.
    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.total_debit).toBe('26000.59');
    const gainLine = findLine(voucher.lines, 'Short Term Capital Gain on Sale of Shares', 'CR');
    expect(gainLine?.amount).toBe('1000.59');
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

  it('posts a negative trader sell-side charge as a CR refund and stays balanced', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const charges = [
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.EXCHANGE_CHARGE, '-0.59'),
    ];
    const voucher = buildSellVoucher(event, TRADER_DEFAULT, charges, costDisposals);

    expect(findLine(voucher.lines, 'Brokerage', 'DR')?.amount).toBe('20.00');
    const exchangeRefund = voucher.lines.find(
      (l) => l.ledger_name.includes('Exchange') && l.dr_cr === 'CR',
    );
    expect(exchangeRefund?.amount).toBe('0.59');
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

  it('negative TDS (refund case): emits a balanced voucher with CR TDS refund line', () => {
    // Rare real-world case: broker/issuer refunds previously-deducted TDS
    // bundled with the dividend posting. The pipeline used to throw
    // E_NEGATIVE_CONTRACT_NOTE_CHARGE. It now sums algebraically and posts
    // the refund as CR on the TDS ledger so the voucher stays balanced.
    const event = makeEvent({
      event_type: EventType.DIVIDEND,
      gross_amount: '1000.00',
      security_id: 'NSE:RELIANCE',
    });
    const tdsRefund = makeChargeEvent(EventType.TDS_ON_DIVIDEND, '-50.00');
    const voucher = buildDividendVoucher(event, [tdsRefund]);

    // DR Bank 1050, CR Dividend 1000, CR TDS 50 → balanced at 1050.
    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.total_debit).toBe('1050.00');
    const drBank = findLine(voucher.lines, 'Bank', 'DR');
    expect(drBank?.amount).toBe('1050.00');
    const crTds = findLine(voucher.lines, 'TDS', 'CR');
    expect(crTds?.amount).toBe('50.00');
    // No DR TDS line in the refund case.
    expect(findLine(voucher.lines, 'TDS', 'DR')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildSttSummaryVoucher — negative-sign (refund) case
// ---------------------------------------------------------------------------
describe('buildSttSummaryVoucher — sign handling', () => {
  it('positive STT: DR STT / CR Broker (existing behavior)', () => {
    const voucher = buildSttSummaryVoucher([
      makeChargeEvent(EventType.STT, '12.50'),
      makeChargeEvent(EventType.STT, '7.50'),
    ]);
    expect(voucher).not.toBeNull();
    expect(voucher!.total_debit).toBe(voucher!.total_credit);
    expect(voucher!.total_debit).toBe('20.00');
    expect(findLine(voucher!.lines, 'Securities Transaction Tax', 'DR')?.amount).toBe('20.00');
    expect(findLine(voucher!.lines, 'Zerodha', 'CR')?.amount).toBe('20.00');
  });

  it('net negative STT (refund): flips to DR Broker / CR STT', () => {
    // Prior behavior: throw E_NEGATIVE_CONTRACT_NOTE_CHARGE. New behavior:
    // broker refunded STT on a cancelled/corrected trade — post the refund
    // as DR Broker (broker paid us back) / CR STT (reverse the expense).
    const voucher = buildSttSummaryVoucher([
      makeChargeEvent(EventType.STT, '5.00'),
      makeChargeEvent(EventType.STT, '-15.00'),
    ]);
    expect(voucher).not.toBeNull();
    expect(voucher!.total_debit).toBe(voucher!.total_credit);
    expect(voucher!.total_debit).toBe('10.00');
    expect(findLine(voucher!.lines, 'Zerodha', 'DR')?.amount).toBe('10.00');
    expect(findLine(voucher!.lines, 'Securities Transaction Tax', 'CR')?.amount).toBe('10.00');
  });

  it('net zero STT: returns null (no voucher emitted)', () => {
    const voucher = buildSttSummaryVoucher([
      makeChargeEvent(EventType.STT, '10.00'),
      makeChargeEvent(EventType.STT, '-10.00'),
    ]);
    expect(voucher).toBeNull();
  });

  it('individual negative STT with positive net: produces a normal DR STT voucher', () => {
    const voucher = buildSttSummaryVoucher([
      makeChargeEvent(EventType.STT, '20.00'),
      makeChargeEvent(EventType.STT, '-5.00'),
    ]);
    expect(voucher).not.toBeNull();
    expect(voucher!.total_debit).toBe('15.00');
    expect(findLine(voucher!.lines, 'Securities Transaction Tax', 'DR')?.amount).toBe('15.00');
    expect(findLine(voucher!.lines, 'Zerodha', 'CR')?.amount).toBe('15.00');
  });
});

// ---------------------------------------------------------------------------
// buildSttSummaryVouchers — monthly grouping (Bug 7)
// ---------------------------------------------------------------------------
describe('buildSttSummaryVouchers — per-calendar-month grouping', () => {
  it('emits ONE voucher per calendar month (Bug 7 requirement)', async () => {
    const { buildSttSummaryVouchers } = await import('../voucher-builder');
    const vouchers = buildSttSummaryVouchers([
      // April 2021
      makeChargeEvent(EventType.STT, '10.00', 'NSE:A', { event_date: '2021-04-05' }),
      makeChargeEvent(EventType.STT, '5.00', 'NSE:B', { event_date: '2021-04-20' }),
      // May 2021
      makeChargeEvent(EventType.STT, '8.00', 'NSE:C', { event_date: '2021-05-10' }),
      // July 2021 (gap from May is fine)
      makeChargeEvent(EventType.STT, '12.00', 'NSE:D', { event_date: '2021-07-07' }),
    ]);

    expect(vouchers).toHaveLength(3);
    // Sorted chronologically so callers can append directly to the voucher list.
    expect(vouchers.map((v) => v.voucher_date)).toEqual([
      '2021-04-20',
      '2021-05-10',
      '2021-07-07',
    ]);

    // April month: 10 + 5 = 15
    expect(vouchers[0].total_debit).toBe('15.00');
    expect(vouchers[0].narrative).toContain('STT for period 2021-04-05 to 2021-04-20 — 2 trade(s)');
    // May month: just 8
    expect(vouchers[1].total_debit).toBe('8.00');
    expect(vouchers[1].narrative).toContain('1 trade(s)');
    // July month: 12
    expect(vouchers[2].total_debit).toBe('12.00');
  });

  it('drops months whose STT events sum to zero', async () => {
    const { buildSttSummaryVouchers } = await import('../voucher-builder');
    const vouchers = buildSttSummaryVouchers([
      // April: net zero — skipped
      makeChargeEvent(EventType.STT, '10.00', 'NSE:A', { event_date: '2021-04-05' }),
      makeChargeEvent(EventType.STT, '-10.00', 'NSE:A', { event_date: '2021-04-06' }),
      // May: non-zero — kept
      makeChargeEvent(EventType.STT, '5.00', 'NSE:B', { event_date: '2021-05-01' }),
    ]);
    expect(vouchers).toHaveLength(1);
    expect(vouchers[0].voucher_date).toBe('2021-05-01');
  });

  it('returns empty array when no events are supplied', async () => {
    const { buildSttSummaryVouchers } = await import('../voucher-builder');
    expect(buildSttSummaryVouchers([])).toEqual([]);
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
    expect(voucher!.voucher_type).toBe(VoucherType.JOURNAL);

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
  it('RATE = (gross + non-STT charges) / qty, not just gross/qty', () => {
    // 10 shares @ 2500 = 25000 gross; non-STT charges = 300; effective = 25300/10 = 2530.00
    // STT (200) is excluded from capitalization per Sec 48 — it's a non-deductible expense.
    const event = makeBuyEvent({ quantity: '10', rate: '2500.00', gross_amount: '25000.00' });
    const charges = [makeChargeEvent(EventType.STT, '200.00'), makeChargeEvent(EventType.BROKERAGE, '300.00')];
    const capitalizeProfile = { ...INVESTOR_DEFAULT, charge_treatment: ChargeTreatment.CAPITALIZE };
    const voucher = buildBuyVoucher(event, capitalizeProfile, charges);

    // Asset line capitalizes gross + brokerage, excluding STT
    const drAsset = voucher.lines.find(l => l.dr_cr === 'DR' && l.quantity !== null)!;
    expect(drAsset.amount).toBe('25300.00');   // gross + non-STT charges
    expect(drAsset.rate).toBe('2530.00');       // (25300) / 10
    expect(drAsset.quantity).toBe('10');

    // STT is posted as its own DR line, not folded into the asset
    const sttLine = voucher.lines.find(l => l.dr_cr === 'DR' && l.ledger_name === 'Securities Transaction Tax');
    expect(sttLine?.amount).toBe('200.00');
  });

  it('RATE differs from event.rate when non-STT charges are present', () => {
    const event = makeBuyEvent({ quantity: '5', rate: '1000.00', gross_amount: '5000.00' });
    const charges = [makeChargeEvent(EventType.BROKERAGE, '250.00')];
    const capitalizeProfile = { ...INVESTOR_DEFAULT, charge_treatment: ChargeTreatment.CAPITALIZE };
    const voucher = buildBuyVoucher(event, capitalizeProfile, charges);

    const drLine = voucher.lines.find(l => l.dr_cr === 'DR' && l.quantity !== null)!;
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
// Uncovered (zero-cost) disposal — emitted by cost-lots.ts when sell quantity
// exceeds open lots. Voucher builder must emit a balanced voucher with NO
// asset / stock-in-trade CR line (nothing to clear). Per FY21-22 review the
// proceeds are routed to the Unmatched Sell Suspense ledger — the reviewer
// cannot assume STCG for a sell with no prior purchase (see ledger-names.ts).
// ---------------------------------------------------------------------------
describe('buildSellVoucher — uncovered disposal (zero cost basis)', () => {
  const zeroCostDisposals = [{
    lot_id: 'uncovered',
    acquisition_date: '2024-06-15',
    quantity_sold: '10',
    unit_cost: '0.000000',
    total_cost: '0.00',
    gain_or_loss: '26000.00',
  }];

  it('investor mode: routes full proceeds to Unmatched Sell Suspense (not STCG)', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], zeroCostDisposals, 100);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    // No CR on the investment asset ledger — there is nothing to clear.
    expect(
      voucher.lines.find((l) => l.dr_cr === 'CR' && l.ledger_name.includes('Investment in Equity Shares')),
    ).toBeUndefined();
    // STCG/LTCG must NOT fire — cost basis is unknown.
    expect(
      voucher.lines.find((l) => l.dr_cr === 'CR' && l.ledger_name.includes('Short Term Capital Gain')),
    ).toBeUndefined();
    // Proceeds land on the Unmatched Sell Suspense ledger for manual review.
    const suspenseLine = voucher.lines.find(
      (l) => l.dr_cr === 'CR' && l.ledger_name === 'Unmatched Sell Suspense',
    );
    expect(suspenseLine).toBeDefined();
    expect(suspenseLine!.amount).toBe('26000.00');
    // Narrative flags the issue so the reviewer can reclassify in Tally.
    expect(voucher.narrative).toContain('REVIEW');
    expect(voucher.narrative).toContain('no prior purchase');
  });

  it('trader mode: routes full gross to Unmatched Sell Suspense (not Trading Sales)', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, TRADER_DEFAULT, [], zeroCostDisposals);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    // No Cost of Shares Sold DR — already guarded upstream when cost = 0.
    expect(findLine(voucher.lines, 'Cost of Shares Sold', 'DR')).toBeUndefined();
    // No Shares-in-Trade CR either — there is nothing to clear.
    expect(findLine(voucher.lines, 'Shares-in-Trade', 'CR')).toBeUndefined();
    // Trading Sales MUST NOT get the gross — that would inflate business
    // revenue for a sell whose cost basis is unknown.
    expect(findLine(voucher.lines, 'Trading Sales', 'CR')).toBeUndefined();
    // Suspense CR absorbs the gross instead.
    const suspenseLine = findLine(voucher.lines, 'Unmatched Sell Suspense', 'CR');
    expect(suspenseLine).toBeDefined();
    expect(suspenseLine!.amount).toBe('26000.00');
  });
});

// ---------------------------------------------------------------------------
// Zero-cost COVERED disposal — e.g. bonus shares with nil acquisition cost.
// These must flow to the capital-gain/loss ledger, NOT to Unmatched Sell
// Suspense. Regression: the old detector treated total_cost == 0 as uncovered,
// which misclassified legitimate zero-cost lots.
// ---------------------------------------------------------------------------
describe('buildSellVoucher — zero-cost covered disposal (bonus shares)', () => {
  const zeroCostCoveredDisposals = [{
    lot_id: 'lot-bonus-001',
    acquisition_date: '2023-01-15',
    quantity_sold: '10',
    unit_cost: '0.000000',
    total_cost: '0.00',
    gain_or_loss: '26000.00',
  }];

  it('investor mode: routes to capital gain ledger, not suspense', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], zeroCostCoveredDisposals, 100);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    // Must NOT route to Unmatched Sell Suspense — this is a covered lot.
    expect(
      voucher.lines.find((l) => l.ledger_name === 'Unmatched Sell Suspense'),
    ).toBeUndefined();
    // Capital gain line must be present (STCG since holding < 12 months
    // from acquisition_date 2023-01-15 to the default sell date).
    const gainLine = voucher.lines.find(
      (l) => l.dr_cr === 'CR' && l.ledger_name.includes('Capital Gain'),
    );
    expect(gainLine).toBeDefined();
  });

  it('trader mode: routes to Trading Sales, not suspense', () => {
    const event = makeSellEvent({ gross_amount: '26000.00' });
    const voucher = buildSellVoucher(event, TRADER_DEFAULT, [], zeroCostCoveredDisposals);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    // Must NOT route to Unmatched Sell Suspense.
    expect(
      voucher.lines.find((l) => l.ledger_name === 'Unmatched Sell Suspense'),
    ).toBeUndefined();
    // Trading Sales must be present for trader mode.
    expect(findLine(voucher.lines, 'Trading Sales', 'CR')).toBeDefined();
  });
});

describe('buildVouchers — negative charge regression fixture', () => {
  it('produces a balanced buy voucher for the checked-in negative-charge contract note', () => {
    // Regression: the CN below mirrors a real Zerodha export with a -0.59
    // exchange-charge rebate. The pipeline used to throw
    // E_NEGATIVE_CONTRACT_NOTE_CHARGE; it now absorbs the rebate into the
    // capitalized asset cost so the upload succeeds.
    const fixturePath = resolve(process.cwd(), 'src', 'tests', 'fixtures', 'negative-charge-cn.json');
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      tradebookRows: Array<Record<string, string>>;
      contractNote: {
        trades: Array<Record<string, string>>;
        charges: Record<string, string>;
      };
    };

    const contractNoteSheets = pairContractNoteData(
      fixture.contractNote.trades,
      [fixture.contractNote.charges],
      [fixture.contractNote.trades.length],
    );
    const events = buildCanonicalEvents({
      tradebookRows: fixture.tradebookRows,
      contractNoteSheets,
      batchId: 'negative-charge-fixture',
      fileIds: { tradebook: 'tradebook-fixture', contractNote: 'contract-note-fixture' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    const vouchers = buildVouchers(events, INVESTOR_DEFAULT, new CostLotTracker());
    expect(vouchers.length).toBeGreaterThan(0);

    // Every voucher must balance — that's the whole point of the regression.
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }

    // The buy voucher for INFY should capitalize gross + brokerage + rebate
    // = 100 + 0 + (-0.59) = 99.41 — matching the contract note's pay_in.
    // Investor-mode trade vouchers are Journal with invoice_intent=NONE,
    // so match by narrative instead.
    const buyVoucher = vouchers.find((v) => v.narrative?.startsWith('Purchase of'));
    expect(buyVoucher).toBeDefined();
    const assetDr = buyVoucher!.lines.find(
      (l) => l.dr_cr === 'DR' && l.ledger_name.includes('Investment in Equity Shares'),
    );
    expect(assetDr?.amount).toBe('99.41');
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

    // All trade vouchers are Journal vouchers; inventory via ledger master flag.
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

  it('sell vouchers stay balanced when rounded lot-level gains would drift by one cent', () => {
    const sellEvent = makeSellEvent({
      event_date: '2024-06-15',
      external_ref: 'T005-S',
      contract_note_ref: 'CN007',
      quantity: '-2',
      rate: '4699.505',
      gross_amount: '9399.01',
    });
    const costDisposals: CostDisposal[] = [
      {
        lot_id: 'lot-1',
        acquisition_date: '2024-06-14',
        quantity_sold: '1',
        unit_cost: '5000.000000',
        total_cost: '5000.00',
        gain_or_loss: '0.01',
      },
      {
        lot_id: 'lot-2',
        acquisition_date: '2024-06-14',
        quantity_sold: '1',
        unit_cost: '4399.000000',
        total_cost: '4399.00',
        gain_or_loss: '0.01',
      },
    ];

    const voucher = buildSellVoucher(sellEvent, INVESTOR_DEFAULT, [], costDisposals, 1);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.total_debit).toBe('9399.01');
    expect(findLine(voucher.lines, 'Short Term Capital Gain', 'CR')?.amount).toBe('0.01');
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

    // 5 vouchers total: CNC buy + CNC sell + 1 consolidated MIS intraday +
    // NRML buy + NRML sell. MIS same-day buy+sell is now folded into ONE
    // intraday voucher by the SPECULATIVE_BUSINESS pre-pass — the per-fill
    // MIS vouchers are no longer emitted.
    expect(vouchers).toHaveLength(5);

    const cncBuy = vouchers.find((voucher) => voucher.external_reference === 'CNC-BUY')!;
    const cncSell = vouchers.find((voucher) => voucher.external_reference === 'CNC-SELL')!;
    const nrmlBuy = vouchers.find((voucher) => voucher.external_reference === 'NRML-BUY')!;
    const nrmlSell = vouchers.find((voucher) => voucher.external_reference === 'NRML-SELL')!;

    expect(findLine(cncBuy.lines, 'Investment in Equity Shares', 'DR')).toBeDefined();
    expect(findLine(cncBuy.lines, 'Shares-in-Trade', 'DR')).toBeUndefined();

    expect(findLine(cncSell.lines, 'Investment in Equity Shares', 'CR')).toBeDefined();
    expect(cncSell.lines.some((line) => line.ledger_name.includes('Speculative'))).toBe(false);

    // MIS (speculative same-day round-trip) is consolidated into ONE
    // intraday voucher: gross_sell 1680 − gross_buy 1600 − charges 16 (2×8
    // brokerage) = +64 netPnL.
    const misConsolidated = vouchers.find((v) =>
      v.narrative?.includes('intraday') && v.narrative?.includes('MISSTOCK'),
    )!;
    expect(misConsolidated).toBeDefined();
    expect(misConsolidated.voucher_type).toBe(VoucherType.JOURNAL);
    expect(misConsolidated.invoice_intent).toBe(InvoiceIntent.NONE);
    expect(misConsolidated.narrative).toBe('8 shares intraday gain in MISSTOCK');
    expect(misConsolidated.lines).toHaveLength(2);
    expect(findLine(misConsolidated.lines, 'Zerodha Broking', 'DR')?.amount).toBe('64.00');
    expect(findLine(misConsolidated.lines, 'Intraday Gain on Sale of Shares', 'CR')?.amount).toBe('64.00');
    // No per-scrip investment ledger line, no inventory metadata.
    expect(findLine(misConsolidated.lines, 'Investment in Equity Shares', 'DR')).toBeUndefined();
    expect(findLine(misConsolidated.lines, 'Investment in Equity Shares', 'CR')).toBeUndefined();
    for (const line of misConsolidated.lines) {
      expect(line.security_id).toBeNull();
      expect(line.quantity).toBeNull();
      expect(line.rate).toBeNull();
      expect(line.stock_item_name).toBeNull();
    }

    // Per-fill MIS vouchers must NOT exist any more.
    expect(vouchers.find((v) => v.external_reference === 'MIS-SELL')).toBeUndefined();

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

// ---------------------------------------------------------------------------
// HARD RULE — Investor trade voucher contract tripwire
// ---------------------------------------------------------------------------
//
// These tests lock in the contract enforced by
// assertInvestorTradeVoucherContract in voucher-builder.ts. If a future
// refactor ever produces an investor-mode trade voucher with a non-Journal
// type or a non-NONE invoice_intent, these tests MUST fail immediately —
// this is the tripwire that prevents the "investor trades show up as
// Sales/Purchase in Tally" bug from ever shipping again.
//
// If you are about to change these tests: STOP and re-read the rationale in
// the header comment of assertInvestorTradeVoucherContract. Weakening this
// contract flips investor books from capital-gains (ITR-2) to business
// income (ITR-3) and silently corrupts the Profit & Loss statement.
// ---------------------------------------------------------------------------
describe('investor trade voucher contract (HARD RULE tripwire)', () => {
  it('every investor-mode buy voucher is Journal + InvoiceIntent.NONE', () => {
    const investorProducts = ['CNC', 'MTF'] as const;
    for (const product of investorProducts) {
      const event = makeBuyEvent({
        quantity: '10',
        rate: '2500.00',
        gross_amount: '25000.00',
        trade_product: product,
      });
      const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, []);
      expect(voucher.voucher_type).toBe(VoucherType.JOURNAL);
      expect(voucher.invoice_intent).toBe(InvoiceIntent.NONE);
    }
  });

  it('every investor-mode sell voucher is Journal + InvoiceIntent.NONE', () => {
    const costDisposals: CostDisposal[] = [
      {
        lot_id: 'lot-1',
        acquisition_date: '2024-06-01',
        quantity_sold: '10',
        unit_cost: '2500.000000',
        total_cost: '25000.00',
        gain_or_loss: '1000.00',
      },
    ];
    const investorProducts = ['CNC', 'MTF'] as const;
    for (const product of investorProducts) {
      const event = makeSellEvent({
        quantity: '-10',
        rate: '2600.00',
        gross_amount: '26000.00',
        trade_product: product,
      });
      const voucher = buildSellVoucher(event, INVESTOR_DEFAULT, [], costDisposals, 100);
      expect(voucher.voucher_type).toBe(VoucherType.JOURNAL);
      expect(voucher.invoice_intent).toBe(InvoiceIntent.NONE);
    }
  });

  it('intraday / speculative trades (classified) also land as Journal + NONE', () => {
    // Speculative trades are derived to INVESTOR mode with EXPENSE charges.
    // They must still honour the JOURNAL + NONE contract.
    const buyEvent = makeBuyEvent({
      quantity: '10',
      rate: '2500.00',
      gross_amount: '25000.00',
      trade_product: 'MIS',
      trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
    });
    const buyVoucher = buildBuyVoucher(buyEvent, INVESTOR_DEFAULT, []);
    expect(buyVoucher.voucher_type).toBe(VoucherType.JOURNAL);
    expect(buyVoucher.invoice_intent).toBe(InvoiceIntent.NONE);

    const sellEvent = makeSellEvent({
      quantity: '-10',
      rate: '2510.00',
      gross_amount: '25100.00',
      trade_product: 'MIS',
      trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
    });
    const sellVoucher = buildSellVoucher(
      sellEvent,
      INVESTOR_DEFAULT,
      [],
      [
        {
          lot_id: 'lot-1',
          acquisition_date: '2024-06-01',
          quantity_sold: '10',
          unit_cost: '2500.000000',
          total_cost: '25000.00',
          gain_or_loss: '100.00',
        },
      ],
      0,
    );
    expect(sellVoucher.voucher_type).toBe(VoucherType.JOURNAL);
    expect(sellVoucher.invoice_intent).toBe(InvoiceIntent.NONE);
  });

  it('trader mode is intentionally exempt and may carry Purchase/Sales intent', () => {
    // The tripwire only fires for INVESTOR mode. Trader mode legitimately
    // tags buy/sell vouchers with invoice_intent so the XML serializer can
    // render them as Tally-native Purchase/Sales invoices. This test pins
    // that exemption so a future over-eager "tighten the rule" change does
    // not silently break trader mode.
    const buyEvent = makeBuyEvent({
      quantity: '10',
      rate: '2500.00',
      gross_amount: '25000.00',
      trade_product: 'NRML',
      trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
    });
    const buyVoucher = buildBuyVoucher(buyEvent, TRADER_DEFAULT, []);
    expect(buyVoucher.voucher_type).toBe(VoucherType.JOURNAL);
    expect(buyVoucher.invoice_intent).toBe(InvoiceIntent.PURCHASE);

    const sellEvent = makeSellEvent({
      quantity: '-10',
      rate: '2600.00',
      gross_amount: '26000.00',
      trade_product: 'NRML',
      trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
    });
    const sellVoucher = buildSellVoucher(
      sellEvent,
      TRADER_DEFAULT,
      [],
      [
        {
          lot_id: 'lot-1',
          acquisition_date: '2024-06-01',
          quantity_sold: '10',
          unit_cost: '2500.000000',
          total_cost: '25000.00',
          gain_or_loss: '1000.00',
        },
      ],
      100,
    );
    expect(sellVoucher.voucher_type).toBe(VoucherType.JOURNAL);
    expect(sellVoucher.invoice_intent).toBe(InvoiceIntent.SALES);
  });

  it('tripwire throws loudly when an investor draft carries PURCHASE intent', () => {
    // Simulate a future regression where invoiceIntentForTrade is rewired or
    // a new code path bypasses the mode check. Build a legitimate investor
    // voucher, mutate the invoice_intent to PURCHASE, then re-run the
    // contract assertion. This MUST throw with E_INVESTOR_TRADE_MUST_BE_JOURNAL.
    const event = makeBuyEvent({
      quantity: '10',
      rate: '2500.00',
      gross_amount: '25000.00',
      trade_product: 'CNC',
    });
    const voucher = buildBuyVoucher(event, INVESTOR_DEFAULT, []);

    // Mutate the draft to simulate a regression upstream.
    const corrupted = { ...voucher, invoice_intent: InvoiceIntent.PURCHASE };

    let thrown: unknown = null;
    try {
      assertInvestorTradeVoucherContract(corrupted, INVESTOR_DEFAULT, event);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(isPipelineValidationError(thrown)).toBe(true);
    if (isPipelineValidationError(thrown)) {
      expect(thrown.code).toBe('E_INVESTOR_TRADE_MUST_BE_JOURNAL');
      expect(thrown.message).toContain('Journal');
      expect(thrown.details?.invoice_intent).toBe(InvoiceIntent.PURCHASE);
    }
  });

  it('tripwire throws when an investor draft carries a non-JOURNAL voucher_type', () => {
    const event = makeSellEvent({
      quantity: '-10',
      rate: '2600.00',
      gross_amount: '26000.00',
      trade_product: 'CNC',
    });
    const voucher = buildSellVoucher(
      event,
      INVESTOR_DEFAULT,
      [],
      [
        {
          lot_id: 'lot-1',
          acquisition_date: '2024-06-01',
          quantity_sold: '10',
          unit_cost: '2500.000000',
          total_cost: '25000.00',
          gain_or_loss: '1000.00',
        },
      ],
      100,
    );

    const corrupted = { ...voucher, voucher_type: VoucherType.SALES };

    let thrown: unknown = null;
    try {
      assertInvestorTradeVoucherContract(corrupted, INVESTOR_DEFAULT, event);
    } catch (err) {
      thrown = err;
    }
    expect(isPipelineValidationError(thrown)).toBe(true);
    if (isPipelineValidationError(thrown)) {
      expect(thrown.code).toBe('E_INVESTOR_TRADE_MUST_BE_JOURNAL');
      expect(thrown.details?.voucher_type).toBe(VoucherType.SALES);
    }
  });

  it('tripwire is silent for trader mode even with PURCHASE/SALES intent', () => {
    // Defense-in-depth: the assertion should NEVER fire for trader mode.
    // If this test breaks, someone has over-tightened the rule and will
    // silently break the trader pipeline.
    const buyEvent = makeBuyEvent({
      quantity: '10',
      rate: '2500.00',
      gross_amount: '25000.00',
      trade_product: 'NRML',
      trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
    });
    const traderBuy = buildBuyVoucher(buyEvent, TRADER_DEFAULT, []);
    expect(() =>
      assertInvestorTradeVoucherContract(traderBuy, TRADER_DEFAULT, buyEvent),
    ).not.toThrow();
  });

  it('full pipeline: investor canonical events → vouchers all respect JOURNAL + NONE', () => {
    // Run the real orchestrator (buildVouchers) with a mix of buy, sell,
    // and charge events to ensure NO trade voucher escapes with a non-NONE
    // invoice_intent. This catches regressions that live in buildVouchers
    // itself (e.g. a new code path that forgets invoiceIntentForTrade).
    const tracker = new CostLotTracker();
    const events = [
      makeBuyEvent({
        event_date: '2024-06-01',
        quantity: '10',
        rate: '2500.00',
        gross_amount: '25000.00',
        trade_product: 'CNC',
      }),
      makeChargeEvent(EventType.BROKERAGE, '20.00', { event_date: '2024-06-01' }),
      makeChargeEvent(EventType.STT, '2.50', { event_date: '2024-06-01' }),
      makeSellEvent({
        event_date: '2024-12-01',
        quantity: '-10',
        rate: '2600.00',
        gross_amount: '26000.00',
        trade_product: 'CNC',
      }),
      makeChargeEvent(EventType.BROKERAGE, '25.00', { event_date: '2024-12-01' }),
    ];
    const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);

    // Every trade voucher (buy or sell) must be JOURNAL + NONE. STT summary
    // / settlement vouchers can be any type, so we filter to trade vouchers
    // by narrative prefix which is stable across versions.
    const tradeVouchers = vouchers.filter(
      (v) =>
        v.narrative?.startsWith('Purchase of') ||
        v.narrative?.startsWith('Sale of'),
    );
    expect(tradeVouchers.length).toBeGreaterThan(0);
    for (const voucher of tradeVouchers) {
      expect(voucher.voucher_type).toBe(VoucherType.JOURNAL);
      expect(voucher.invoice_intent).toBe(InvoiceIntent.NONE);
    }
  });
});

// ---------------------------------------------------------------------------
// buildIntradayConsolidatedVoucher — investor-mode same-day round-trip
// ---------------------------------------------------------------------------
describe('buildIntradayConsolidatedVoucher', () => {
  // Helper: build an intraday trade event (BUY or SELL) with
  // SPECULATIVE_BUSINESS classification — the only classification the
  // voucher consolidator accepts.
  function makeIntradayBuy(overrides: Partial<Parameters<typeof makeBuyEvent>[0]> = {}) {
    return makeBuyEvent({
      event_date: '2021-04-07',
      security_id: 'NSE:GRAPHITE',
      trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
      contract_note_ref: 'CN-FY22-7',
      ...overrides,
    });
  }
  function makeIntradaySell(overrides: Partial<Parameters<typeof makeSellEvent>[0]> = {}) {
    return makeSellEvent({
      event_date: '2021-04-07',
      security_id: 'NSE:GRAPHITE',
      trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
      contract_note_ref: 'CN-FY22-7',
      ...overrides,
    });
  }
  function makeIntradayCharge(type: EventType, amount: string) {
    return makeChargeEvent(type, amount, 'NSE:GRAPHITE', {
      event_date: '2021-04-07',
      trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
    });
  }

  it('gain: emits Journal with DR broker, DR STT, CR intraday ledger (STT separate)', () => {
    // buy 50 @ 100 (gross 5000), sell 50 @ 110 (gross 5500).
    // Non-STT charges = 25 (brokerage 20 + GST 5). STT = 25.
    // netPnL = 5500 - 5000 - 25 = +475 → gain (excludes STT).
    // Broker impact = 5500 - 5000 - 50 = 450 (net of ALL charges).
    const buy = makeIntradayBuy({ quantity: '50', rate: '100', gross_amount: '5000.00' });
    const sell = makeIntradaySell({ quantity: '-50', rate: '110', gross_amount: '5500.00' });
    const charges = [
      makeIntradayCharge(EventType.BROKERAGE, '20.00'),
      makeIntradayCharge(EventType.STT, '25.00'),
      makeIntradayCharge(EventType.GST_ON_CHARGES, '5.00'),
    ];
    const voucher = buildIntradayConsolidatedVoucher([buy], [sell], charges, INVESTOR_DEFAULT);
    expect(voucher).not.toBeNull();
    const v = voucher!;
    expect(v.voucher_type).toBe(VoucherType.JOURNAL);
    expect(v.invoice_intent).toBe(InvoiceIntent.NONE);
    // 3 lines: DR broker (450), DR STT (25), CR intraday (475).
    expect(v.lines).toHaveLength(3);

    const brokerDr = findLine(v.lines, 'Zerodha Broking', 'DR');
    const sttDr = findLine(v.lines, 'Securities Transaction Tax', 'DR');
    const intradayCr = findLine(v.lines, 'Intraday Gain on Sale of Shares', 'CR');
    expect(brokerDr?.amount).toBe('450.00');
    expect(sttDr?.amount).toBe('25.00');
    expect(intradayCr?.amount).toBe('475.00');

    // Voucher is balanced: 450 + 25 = 475.
    expect(v.total_debit).toBe(v.total_credit);

    // Plain accounting lines: no inventory metadata anywhere.
    for (const line of v.lines) {
      expect(line.security_id).toBeNull();
      expect(line.quantity).toBeNull();
      expect(line.rate).toBeNull();
      expect(line.stock_item_name).toBeNull();
    }

    expect(v.narrative).toBe('50 shares intraday gain in GRAPHITE');

    // Voucher number = bare CN ref (no /SYMBOL suffix).
    expect(v.external_reference).toBe('CN-FY22-7');

    expect(v.source_event_ids).toContain(buy.event_id);
    expect(v.source_event_ids).toContain(sell.event_id);
    for (const c of charges) expect(v.source_event_ids).toContain(c.event_id);
  });

  it('loss: emits Journal with DR intraday, DR STT, CR broker (STT separate)', () => {
    // buy 50 @ 110 (gross 5500), sell 50 @ 100 (gross 5000).
    // Non-STT charges = 25. STT = 25.
    // netPnL = 5000 - 5500 - 25 = -525 → loss (excludes STT).
    // Broker impact = 5000 - 5500 - 50 = -550.
    const buy = makeIntradayBuy({ quantity: '50', rate: '110', gross_amount: '5500.00' });
    const sell = makeIntradaySell({ quantity: '-50', rate: '100', gross_amount: '5000.00' });
    const charges = [
      makeIntradayCharge(EventType.BROKERAGE, '20.00'),
      makeIntradayCharge(EventType.STT, '25.00'),
      makeIntradayCharge(EventType.GST_ON_CHARGES, '5.00'),
    ];
    const voucher = buildIntradayConsolidatedVoucher([buy], [sell], charges, INVESTOR_DEFAULT);
    expect(voucher).not.toBeNull();
    const v = voucher!;

    // Loss case: DR intraday (525), DR STT (25), CR broker (550).
    const intradayDr = findLine(v.lines, 'Intraday Gain on Sale of Shares', 'DR');
    const sttDr = findLine(v.lines, 'Securities Transaction Tax', 'DR');
    const brokerCr = findLine(v.lines, 'Zerodha Broking', 'CR');
    expect(intradayDr?.amount).toBe('525.00');
    expect(sttDr?.amount).toBe('25.00');
    expect(brokerCr?.amount).toBe('550.00');

    expect(v.narrative).toBe('50 shares intraday loss in GRAPHITE');
  });

  it('multi-fill buy + single-fill sell: sums gross correctly before computing netPnL', () => {
    // 30 @ 100 + 20 @ 102 buys = 3000 + 2040 = 5040 gross buy.
    // Single 50 @ 110 sell = 5500 gross sell.
    // Non-STT charges = 20 (brokerage 15 + GST 5). STT = 20.
    // netPnL = 5500 - 5040 - 20 = +440 (excludes STT).
    // Broker impact = 5500 - 5040 - 40 = 420.
    const buy1 = makeIntradayBuy({ quantity: '30', rate: '100', gross_amount: '3000.00' });
    const buy2 = makeIntradayBuy({ quantity: '20', rate: '102', gross_amount: '2040.00' });
    const sell = makeIntradaySell({ quantity: '-50', rate: '110', gross_amount: '5500.00' });
    const charges = [
      makeIntradayCharge(EventType.BROKERAGE, '15.00'),
      makeIntradayCharge(EventType.STT, '20.00'),
      makeIntradayCharge(EventType.GST_ON_CHARGES, '5.00'),
    ];
    const voucher = buildIntradayConsolidatedVoucher([buy1, buy2], [sell], charges, INVESTOR_DEFAULT);
    expect(voucher).not.toBeNull();
    const v = voucher!;
    const brokerDr = findLine(v.lines, 'Zerodha Broking', 'DR');
    const sttDr = findLine(v.lines, 'Securities Transaction Tax', 'DR');
    const intradayCr = findLine(v.lines, 'Intraday Gain on Sale of Shares', 'CR');
    expect(brokerDr?.amount).toBe('420.00');
    expect(sttDr?.amount).toBe('20.00');
    expect(intradayCr?.amount).toBe('440.00');
    expect(v.narrative).toBe('50 shares intraday gain in GRAPHITE');
  });

  it('zero broker impact but non-zero gain: STT and intraday ledger still posted', () => {
    // buy 50 @ 100, sell 50 @ 101 (gross 5050).
    // Non-STT charges = 25. STT = 25.
    // netPnL = 5050 - 5000 - 25 = +25 (gain, excludes STT).
    // Broker impact = 5050 - 5000 - 50 = 0 (gain exactly cancels ALL charges).
    // The broker line is omitted (zero amount), but the P&L and STT lines
    // are still emitted so the user sees the STT expense and intraday gain.
    const buy = makeIntradayBuy({ quantity: '50', rate: '100', gross_amount: '5000.00' });
    const sell = makeIntradaySell({ quantity: '-50', rate: '101', gross_amount: '5050.00' });
    const charges = [
      makeIntradayCharge(EventType.BROKERAGE, '20.00'),
      makeIntradayCharge(EventType.STT, '25.00'),
      makeIntradayCharge(EventType.GST_ON_CHARGES, '5.00'),
    ];
    const voucher = buildIntradayConsolidatedVoucher([buy], [sell], charges, INVESTOR_DEFAULT);
    expect(voucher).not.toBeNull();
    const v = voucher!;
    // 2 lines: DR STT (25), CR intraday (25). Broker = 0 → omitted.
    expect(v.lines).toHaveLength(2);
    const sttDr = findLine(v.lines, 'Securities Transaction Tax', 'DR');
    const intradayCr = findLine(v.lines, 'Intraday Gain on Sale of Shares', 'CR');
    expect(sttDr?.amount).toBe('25.00');
    expect(intradayCr?.amount).toBe('25.00');
    expect(v.total_debit).toBe(v.total_credit);
  });

  it('truly zero-net (no charges at all, gross equals) returns null', () => {
    // buy 50 @ 100, sell 50 @ 100. No charges. netPnL = 0. Broker = 0. STT = 0.
    const buy = makeIntradayBuy({ quantity: '50', rate: '100', gross_amount: '5000.00' });
    const sell = makeIntradaySell({ quantity: '-50', rate: '100', gross_amount: '5000.00' });
    const voucher = buildIntradayConsolidatedVoucher([buy], [sell], [], INVESTOR_DEFAULT);
    expect(voucher).toBeNull();
  });

  it('tripwire: passes assertInvestorTradeVoucherContract (Journal + NONE)', () => {
    // Defense-in-depth: the consolidated intraday voucher runs through the
    // same hard tripwire as delivery vouchers. If anyone ever rewires the
    // builder to emit a Sales/Purchase voucher for intraday, this test
    // catches it at the source instead of at XML-serialization time.
    const buy = makeIntradayBuy({ quantity: '50', rate: '100', gross_amount: '5000.00' });
    const sell = makeIntradaySell({ quantity: '-50', rate: '110', gross_amount: '5500.00' });
    const voucher = buildIntradayConsolidatedVoucher([buy], [sell], [], INVESTOR_DEFAULT);
    expect(voucher).not.toBeNull();
    expect(() =>
      assertInvestorTradeVoucherContract(voucher!, INVESTOR_DEFAULT, buy),
    ).not.toThrow();
  });

  it('buildVouchers orchestrator: same-day round-trip with STT produces ONE intraday voucher and does NOT leak STT into the summary voucher', () => {
    // End-to-end integration: buildVouchers() must (a) fold the round-trip
    // into a single consolidated voucher, (b) NOT emit two per-fill
    // delivery vouchers, and (c) NOT push intraday STT into the lump-sum
    // STT summary voucher (that would double-credit Zerodha).
    const tracker = new CostLotTracker();
    const events = [
      makeIntradayBuy({ quantity: '50', rate: '100', gross_amount: '5000.00' }),
      makeIntradayCharge(EventType.BROKERAGE, '20.00'),
      makeIntradayCharge(EventType.STT, '25.00'),
      makeIntradayCharge(EventType.GST_ON_CHARGES, '5.00'),
      makeIntradaySell({ quantity: '-50', rate: '110', gross_amount: '5500.00' }),
    ];
    const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);

    // Exactly one intraday voucher, no per-fill delivery vouchers.
    const intradayVouchers = vouchers.filter((v) =>
      v.narrative?.includes('intraday gain') || v.narrative?.includes('intraday loss'),
    );
    expect(intradayVouchers).toHaveLength(1);
    expect(intradayVouchers[0].narrative).toBe('50 shares intraday gain in GRAPHITE');

    // No delivery buy/sell voucher for the same scrip.
    const deliveryTradeVouchers = vouchers.filter(
      (v) =>
        v.narrative?.startsWith('Purchase of GRAPHITE') ||
        v.narrative?.startsWith('Sale of GRAPHITE'),
    );
    expect(deliveryTradeVouchers).toHaveLength(0);

    // STT summary voucher: must either not exist, or have zero amount.
    // The intraday pre-pass must never add intraday STT to filteredSttEvents.
    const sttSummary = vouchers.filter((v) => v.narrative?.includes('STT for period'));
    if (sttSummary.length > 0) {
      for (const s of sttSummary) {
        expect(s.total_debit).toBe('0.00');
      }
    }
  });
});
