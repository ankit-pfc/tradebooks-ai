import { describe, expect, it } from 'vitest';
import { EventType, type CanonicalEvent } from '../../lib/types/events';
import { INVESTOR_DEFAULT, TRADER_DEFAULT, INVESTOR_TALLY_DEFAULT, TRADER_TALLY_DEFAULT } from '../../lib/engine/accounting-policy';
import { CostLotTracker } from '../../lib/engine/cost-lots';
import {
  buildBuyVoucher,
  buildSellVoucher,
  buildSettlementVoucher,
  buildDividendVoucher,
  buildVouchers,
} from '../../lib/engine/voucher-builder';

// ---------------------------------------------------------------------------
// Test event factory
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<CanonicalEvent> & { event_type: EventType }): CanonicalEvent {
  return {
    event_id: crypto.randomUUID(),
    import_batch_id: 'batch-test',
    event_type: overrides.event_type,
    event_date: '2024-04-01',
    settlement_date: null,
    security_id: overrides.security_id ?? 'NSE:RELIANCE',
    quantity: overrides.quantity ?? '10',
    rate: overrides.rate ?? '2500.00',
    gross_amount: overrides.gross_amount ?? '25000.00',
    charge_type: overrides.charge_type ?? null,
    charge_amount: overrides.charge_amount ?? '0',
    source_file_id: 'file-test',
    source_row_ids: [],
    contract_note_ref: null,
    external_ref: null,
    event_hash: 'test-hash',
    ...overrides,
  };
}

function makeChargeEvent(eventType: EventType, amount: string, securityId = 'NSE:RELIANCE'): CanonicalEvent {
  return makeEvent({
    event_type: eventType,
    security_id: securityId,
    charge_type: eventType,
    charge_amount: amount,
    gross_amount: '0',
    quantity: '0',
    rate: '0',
  });
}

// ---------------------------------------------------------------------------
// Tests: buildBuyVoucher with TallyProfile
// ---------------------------------------------------------------------------

describe('buildBuyVoucher with TallyProfile', () => {
  const buyEvent = makeEvent({ event_type: EventType.BUY_TRADE });
  const brokerageCharge = makeChargeEvent(EventType.BROKERAGE, '20.00');
  const sttCharge = makeChargeEvent(EventType.STT, '25.00');

  it('uses Capital Account ledger names with INVESTOR_TALLY_DEFAULT', () => {
    const voucher = buildBuyVoucher(buyEvent, INVESTOR_DEFAULT, [brokerageCharge, sttCharge], INVESTOR_TALLY_DEFAULT);

    // Asset should use {symbol}-SH pattern
    const assetLine = voucher.lines.find(l => l.dr_cr === 'DR' && l.ledger_name.includes('RELIANCE'));
    expect(assetLine?.ledger_name).toBe('RELIANCE-SH');

    // Broker should use Capital Account broker
    const brokerLine = voucher.lines.find(l => l.dr_cr === 'CR');
    expect(brokerLine?.ledger_name).toBe(INVESTOR_TALLY_DEFAULT.broker.name);

    // Voucher must balance
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('uses EXPENSE charge names with INVESTOR_TALLY_DEFAULT when not capitalizing', () => {
    const expenseProfile = { ...INVESTOR_DEFAULT, charge_treatment: 'EXPENSE' as const };
    const voucher = buildBuyVoucher(buyEvent, expenseProfile, [brokerageCharge, sttCharge], INVESTOR_TALLY_DEFAULT);

    // Charges should be consolidated per TallyProfile
    const chargeLines = voucher.lines.filter(l => l.dr_cr === 'DR' && !l.ledger_name.includes('RELIANCE'));
    const chargeNames = chargeLines.map(l => l.ledger_name);
    expect(chargeNames).toContain(INVESTOR_TALLY_DEFAULT.chargeConsolidation[0].ledgerName); // Brokerage
    expect(chargeNames).toContain(INVESTOR_TALLY_DEFAULT.chargeConsolidation[1].ledgerName); // STT
  });

  it('uses trader stock-in-trade ledger with TRADER_TALLY_DEFAULT', () => {
    const voucher = buildBuyVoucher(buyEvent, TRADER_DEFAULT, [brokerageCharge], TRADER_TALLY_DEFAULT);

    const assetLine = voucher.lines.find(l => l.dr_cr === 'DR' && l.ledger_name.includes('RELIANCE'));
    expect(assetLine?.ledger_name).toBe('Shares-in-Trade - RELIANCE');
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

// ---------------------------------------------------------------------------
// Tests: buildSellVoucher with TallyProfile
// ---------------------------------------------------------------------------

describe('buildSellVoucher with TallyProfile', () => {
  const sellEvent = makeEvent({
    event_type: EventType.SELL_TRADE,
    quantity: '-5',
    gross_amount: '13000.00',
  });
  const costDisposals = [{
    lot_id: 'lot-1',
    acquisition_date: '2024-01-15',
    quantity_sold: '5',
    unit_cost: '2500.00',
    total_cost: '12500.00',
    gain_or_loss: '500.00',
  }];

  it('resolves per-scrip STCG ledger with INVESTOR_TALLY_DEFAULT for short-term gain', () => {
    const voucher = buildSellVoucher(
      sellEvent, INVESTOR_DEFAULT, [], costDisposals, 100, INVESTOR_TALLY_DEFAULT,
    );

    const gainLine = voucher.lines.find(l => l.ledger_name.includes('STCG'));
    expect(gainLine?.ledger_name).toBe('STCG ON RELIANCE');
    expect(gainLine?.dr_cr).toBe('CR');
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('resolves per-scrip LTCG ledger for long-term gain (>365 days)', () => {
    const voucher = buildSellVoucher(
      sellEvent, INVESTOR_DEFAULT, [], costDisposals, 400, INVESTOR_TALLY_DEFAULT,
    );

    const gainLine = voucher.lines.find(l => l.ledger_name.includes('LTCG'));
    expect(gainLine?.ledger_name).toBe('LTCG ON RELIANCE');
    expect(gainLine?.dr_cr).toBe('CR');
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('resolves loss ledger for negative gain', () => {
    const lossDisposals = [{
      lot_id: 'lot-1',
      acquisition_date: '2024-01-15',
      quantity_sold: '5',
      unit_cost: '2700.00',
      total_cost: '13500.00',
      gain_or_loss: '-500.00',
    }];

    const voucher = buildSellVoucher(
      sellEvent, INVESTOR_DEFAULT, [], lossDisposals, 100, INVESTOR_TALLY_DEFAULT,
    );

    const lossLine = voucher.lines.find(l => l.ledger_name.includes('STCL'));
    expect(lossLine?.ledger_name).toBe('STCL ON RELIANCE');
    expect(lossLine?.dr_cr).toBe('DR');
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('routes speculation (holding period 0) to speculation ledger', () => {
    const voucher = buildSellVoucher(
      sellEvent, INVESTOR_DEFAULT, [], costDisposals, 0, INVESTOR_TALLY_DEFAULT,
    );

    const specLine = voucher.lines.find(l =>
      l.ledger_name === INVESTOR_TALLY_DEFAULT.speculationGain.name,
    );
    expect(specLine).toBeDefined();
    expect(specLine?.dr_cr).toBe('CR');
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('uses Capital Account asset and broker ledger names', () => {
    const voucher = buildSellVoucher(
      sellEvent, INVESTOR_DEFAULT, [], costDisposals, 100, INVESTOR_TALLY_DEFAULT,
    );

    // Asset should use {symbol}-SH
    const assetLine = voucher.lines.find(l => l.dr_cr === 'CR' && l.ledger_name.includes('RELIANCE'));
    expect(assetLine?.ledger_name).toBe('RELIANCE-SH');

    // Broker should use Capital Account broker name
    const brokerLine = voucher.lines.find(l => l.ledger_name === INVESTOR_TALLY_DEFAULT.broker.name);
    expect(brokerLine).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: buildSettlementVoucher with TallyProfile
// ---------------------------------------------------------------------------

describe('buildSettlementVoucher with TallyProfile', () => {
  it('uses TallyProfile broker and bank names', () => {
    const receiptEvent = makeEvent({
      event_type: EventType.BANK_RECEIPT,
      gross_amount: '50000.00',
      security_id: null,
    });

    const voucher = buildSettlementVoucher(receiptEvent, INVESTOR_TALLY_DEFAULT);

    const drLine = voucher.lines.find(l => l.dr_cr === 'DR');
    const crLine = voucher.lines.find(l => l.dr_cr === 'CR');
    expect(drLine?.ledger_name).toBe(INVESTOR_TALLY_DEFAULT.bank.name);
    expect(crLine?.ledger_name).toBe(INVESTOR_TALLY_DEFAULT.broker.name);
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

// ---------------------------------------------------------------------------
// Tests: buildDividendVoucher with TallyProfile
// ---------------------------------------------------------------------------

describe('buildDividendVoucher with TallyProfile', () => {
  it('uses per-scrip dividend ledger with INVESTOR_TALLY_DEFAULT', () => {
    const divEvent = makeEvent({
      event_type: EventType.DIVIDEND,
      gross_amount: '500.00',
      security_id: 'NSE:RELIANCE',
    });

    const voucher = buildDividendVoucher(divEvent, [], INVESTOR_TALLY_DEFAULT);

    const crLine = voucher.lines.find(l => l.dr_cr === 'CR');
    expect(crLine?.ledger_name).toBe('DIV RELIANCE');
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('uses pooled dividend ledger with TRADER_TALLY_DEFAULT', () => {
    const divEvent = makeEvent({
      event_type: EventType.DIVIDEND,
      gross_amount: '500.00',
      security_id: 'NSE:INFY',
    });

    const voucher = buildDividendVoucher(divEvent, [], TRADER_TALLY_DEFAULT);

    const crLine = voucher.lines.find(l => l.dr_cr === 'CR');
    // Trader mode: pooled dividend (template without {symbol})
    expect(crLine?.ledger_name).toBe(TRADER_TALLY_DEFAULT.dividend.template);
  });
});

// ---------------------------------------------------------------------------
// Tests: buildVouchers orchestrator passes TallyProfile through
// ---------------------------------------------------------------------------

describe('buildVouchers orchestrator with TallyProfile', () => {
  it('passes TallyProfile through to all sub-builders', () => {
    const events: CanonicalEvent[] = [
      makeEvent({
        event_type: EventType.BUY_TRADE,
        event_date: '2024-04-01',
        quantity: '10',
        rate: '2500.00',
        gross_amount: '25000.00',
      }),
      makeEvent({
        event_type: EventType.SELL_TRADE,
        event_date: '2024-04-02',
        quantity: '-10',
        rate: '2600.00',
        gross_amount: '26000.00',
      }),
    ];

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker, INVESTOR_TALLY_DEFAULT);

    expect(vouchers).toHaveLength(2);

    // Delivery investor trades use Purchase/Sales vouchers so Tally
    // processes INVENTORYALLOCATIONS.LIST through Invoice Voucher View.
    const buyVoucher = vouchers.find(v => v.narrative?.includes('Purchase'));
    expect(buyVoucher).toBeDefined();
    expect(buyVoucher!.voucher_type).toBe('PURCHASE');
    const buyAssetLine = buyVoucher!.lines.find(l => l.dr_cr === 'DR');
    expect(buyAssetLine?.ledger_name).toBe('RELIANCE-SH');

    // Sell voucher should use Capital Account gain ledger
    const sellVoucher = vouchers.find(v => v.narrative?.includes('Sale'));
    expect(sellVoucher).toBeDefined();
    expect(sellVoucher!.voucher_type).toBe('SALES');
    const gainLine = sellVoucher!.lines.find(l => l.ledger_name.includes('STCG'));
    expect(gainLine?.ledger_name).toBe('STCG ON RELIANCE');

    // All vouchers must balance
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
  });

  it('produces identical results without TallyProfile (backward compat)', () => {
    const events: CanonicalEvent[] = [
      makeEvent({ event_type: EventType.BUY_TRADE }),
    ];

    const tracker1 = new CostLotTracker();
    const tracker2 = new CostLotTracker();
    const withProfile = buildVouchers(events, INVESTOR_DEFAULT, tracker1);
    const withoutProfile = buildVouchers(events, INVESTOR_DEFAULT, tracker2, undefined);

    expect(withProfile.length).toBe(withoutProfile.length);
    // Both should use old-style ledger names
    const line1 = withProfile[0].lines.find(l => l.dr_cr === 'DR');
    const line2 = withoutProfile[0].lines.find(l => l.dr_cr === 'DR');
    expect(line1?.ledger_name).toBe(line2?.ledger_name);
    expect(line1?.ledger_name).toContain('Investment in Equity Shares');
  });
});
