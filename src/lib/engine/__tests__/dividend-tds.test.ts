/**
 * dividend-tds.test.ts
 * Tests for Phase 3a: TDS on Dividends
 *
 * Covers:
 *  - dividendRowToEvents() — conversion of dividend rows to events
 *  - buildDividendVoucher() — three-legged journal with TDS
 *  - buildVouchers() — charge-index integration for TDS
 *  - buildCanonicalEvents() — funds-statement dedup when dividendRows present
 *  - checkDividendTdsReconciliation() — reconciliation check
 */

import { describe, it, expect } from 'vitest';
import { EventType, type CanonicalEvent } from '../../types/events';
import type { ZerodhaDividendRow } from '../../parsers/zerodha/types';
import {
  dividendRowToEvents,
  buildCanonicalEvents,
} from '../canonical-events';
import { buildDividendVoucher, buildVouchers } from '../voucher-builder';
import { CostLotTracker } from '../cost-lots';
import {
  AccountingMode,
  ChargeTreatment,
  VoucherGranularity,
  LedgerStrategy,
  CostBasisMethod,
} from '../../types/accounting';
import { checkDividendTdsReconciliation } from '../../reconciliation/checks';
import { INVESTOR_TALLY_DEFAULT } from '../accounting-policy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDividendRow(overrides: Partial<ZerodhaDividendRow> = {}): ZerodhaDividendRow {
  return {
    symbol: 'RELIANCE',
    isin: 'INE002A01018',
    ex_date: '2025-01-15',
    quantity: '100',
    dividend_per_share: '10',
    net_dividend_amount: '900',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CanonicalEvent>): CanonicalEvent {
  return {
    event_id: crypto.randomUUID(),
    import_batch_id: 'batch-1',
    event_type: EventType.DIVIDEND,
    event_date: '2025-01-15',
    settlement_date: null,
    security_id: 'UNKNOWN:RELIANCE',
    quantity: '100',
    rate: '10',
    gross_amount: '1000.00',
    charge_type: null,
    charge_amount: '0',
    source_file_id: 'file-1',
    source_row_ids: [],
    contract_note_ref: null,
    external_ref: null,
    event_hash: 'hash-1',
    ...overrides,
  };
}

const DEFAULT_PROFILE = {
  accounting_profile_id: 'test-investor',
  profile_name: 'Test Investor',
  mode: AccountingMode.INVESTOR,
  charge_treatment: ChargeTreatment.EXPENSE,
  voucher_granularity: VoucherGranularity.TRADE_LEVEL,
  ledger_strategy: LedgerStrategy.SCRIPT_LEVEL,
  cost_basis_method: CostBasisMethod.FIFO,
  rounding_rules: { decimal_places: 2 },
};

// ---------------------------------------------------------------------------
// dividendRowToEvents
// ---------------------------------------------------------------------------

describe('dividendRowToEvents', () => {
  it('produces DIVIDEND + TDS_ON_DIVIDEND events when TDS is deducted', () => {
    const row = makeDividendRow(); // qty=100, dps=10, net=900 → gross=1000, tds=100
    const events = dividendRowToEvents(row, 'batch-1', 'file-1');

    expect(events).toHaveLength(2);

    const divEvent = events[0];
    expect(divEvent.event_type).toBe(EventType.DIVIDEND);
    expect(divEvent.gross_amount).toBe('1000.00');
    expect(divEvent.security_id).toBe('UNKNOWN:RELIANCE');
    expect(divEvent.quantity).toBe('100');
    expect(divEvent.rate).toBe('10');

    const tdsEvent = events[1];
    expect(tdsEvent.event_type).toBe(EventType.TDS_ON_DIVIDEND);
    expect(tdsEvent.charge_amount).toBe('100.00');
    expect(tdsEvent.charge_type).toBe('TDS_ON_DIVIDEND');
    expect(tdsEvent.security_id).toBe('UNKNOWN:RELIANCE');
  });

  it('produces only DIVIDEND event when TDS is zero', () => {
    const row = makeDividendRow({
      quantity: '100',
      dividend_per_share: '5',
      net_dividend_amount: '500', // gross=500, net=500, tds=0
    });
    const events = dividendRowToEvents(row, 'batch-1', 'file-1');

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe(EventType.DIVIDEND);
    expect(events[0].gross_amount).toBe('500.00');
  });

  it('handles fractional TDS amounts correctly', () => {
    const row = makeDividendRow({
      quantity: '50',
      dividend_per_share: '3.75',
      net_dividend_amount: '168.75', // gross=187.50, tds=18.75
    });
    const events = dividendRowToEvents(row, 'batch-1', 'file-1');

    expect(events).toHaveLength(2);
    expect(events[0].gross_amount).toBe('187.50');
    expect(events[1].charge_amount).toBe('18.75');
  });

  it('produces deterministic hashes for the same input', () => {
    const row = makeDividendRow();
    const events1 = dividendRowToEvents(row, 'batch-1', 'file-1');
    const events2 = dividendRowToEvents(row, 'batch-1', 'file-1');

    expect(events1[0].event_hash).toBe(events2[0].event_hash);
    expect(events1[1].event_hash).toBe(events2[1].event_hash);
  });

  it('produces different hashes for different symbols', () => {
    const row1 = makeDividendRow({ symbol: 'RELIANCE' });
    const row2 = makeDividendRow({ symbol: 'INFY' });
    const events1 = dividendRowToEvents(row1, 'batch-1', 'file-1');
    const events2 = dividendRowToEvents(row2, 'batch-1', 'file-1');

    expect(events1[0].event_hash).not.toBe(events2[0].event_hash);
  });

  it('builds UNKNOWN: prefixed security_id', () => {
    const row = makeDividendRow({ symbol: '  infy  ' });
    const events = dividendRowToEvents(row, 'batch-1', 'file-1');
    expect(events[0].security_id).toBe('UNKNOWN:INFY');
  });
});

// ---------------------------------------------------------------------------
// buildDividendVoucher with TDS
// ---------------------------------------------------------------------------

describe('buildDividendVoucher with TDS', () => {
  it('creates three-legged voucher when TDS events are present', () => {
    const divEvent = makeEvent({ gross_amount: '1000.00' });
    const tdsEvent = makeEvent({
      event_type: EventType.TDS_ON_DIVIDEND,
      charge_type: 'TDS_ON_DIVIDEND',
      charge_amount: '100.00',
      gross_amount: '0',
    });

    const voucher = buildDividendVoucher(divEvent, [tdsEvent]);

    expect(voucher.lines).toHaveLength(3);

    // DR Bank receives net (900)
    const bankLine = voucher.lines.find(l => l.dr_cr === 'DR' && l.amount === '900.00');
    expect(bankLine).toBeDefined();

    // DR TDS (100)
    const tdsLine = voucher.lines.find(l => l.dr_cr === 'DR' && l.amount === '100.00');
    expect(tdsLine).toBeDefined();
    expect(tdsLine!.ledger_name).toBe('TDS ON DIVIDEND');

    // CR Dividend Income (1000)
    const crLine = voucher.lines.find(l => l.dr_cr === 'CR');
    expect(crLine).toBeDefined();
    expect(crLine!.amount).toBe('1000.00');

    // Balanced
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('creates two-legged voucher when no TDS events', () => {
    const divEvent = makeEvent({ gross_amount: '500.00' });
    const voucher = buildDividendVoucher(divEvent, []);

    expect(voucher.lines).toHaveLength(2);

    const drLine = voucher.lines.find(l => l.dr_cr === 'DR');
    expect(drLine!.amount).toBe('500.00');

    const crLine = voucher.lines.find(l => l.dr_cr === 'CR');
    expect(crLine!.amount).toBe('500.00');

    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('uses TallyProfile TDS ledger name when provided', () => {
    const divEvent = makeEvent({ gross_amount: '1000.00' });
    const tdsEvent = makeEvent({
      event_type: EventType.TDS_ON_DIVIDEND,
      charge_type: 'TDS_ON_DIVIDEND',
      charge_amount: '100.00',
      gross_amount: '0',
    });

    const voucher = buildDividendVoucher(divEvent, [tdsEvent], INVESTOR_TALLY_DEFAULT);

    const tdsLine = voucher.lines.find(
      l => l.dr_cr === 'DR' && l.ledger_name === INVESTOR_TALLY_DEFAULT.tdsOnDividend.name,
    );
    expect(tdsLine).toBeDefined();
  });

  it('includes all source event IDs', () => {
    const divEvent = makeEvent({ gross_amount: '1000.00' });
    const tdsEvent = makeEvent({
      event_type: EventType.TDS_ON_DIVIDEND,
      charge_type: 'TDS_ON_DIVIDEND',
      charge_amount: '100.00',
      gross_amount: '0',
    });

    const voucher = buildDividendVoucher(divEvent, [tdsEvent]);

    expect(voucher.source_event_ids).toContain(divEvent.event_id);
    expect(voucher.source_event_ids).toContain(tdsEvent.event_id);
  });

  it('includes symbol in narrative', () => {
    const divEvent = makeEvent({
      gross_amount: '1000.00',
      security_id: 'UNKNOWN:RELIANCE',
    });
    const voucher = buildDividendVoucher(divEvent, []);
    expect(voucher.narrative).toContain('RELIANCE');
  });
});

// ---------------------------------------------------------------------------
// buildVouchers integration — TDS charge-index pairing
// ---------------------------------------------------------------------------

describe('buildVouchers TDS integration', () => {
  it('pairs TDS_ON_DIVIDEND with DIVIDEND via chargeIndex', () => {
    const divEvent = makeEvent({
      event_type: EventType.DIVIDEND,
      event_date: '2025-01-15',
      security_id: 'UNKNOWN:RELIANCE',
      gross_amount: '1000.00',
    });
    const tdsEvent = makeEvent({
      event_type: EventType.TDS_ON_DIVIDEND,
      event_date: '2025-01-15',
      security_id: 'UNKNOWN:RELIANCE',
      charge_type: 'TDS_ON_DIVIDEND',
      charge_amount: '100.00',
      gross_amount: '0',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers([divEvent, tdsEvent], DEFAULT_PROFILE, tracker);

    expect(vouchers).toHaveLength(1);
    const v = vouchers[0];

    // Should be three-legged
    expect(v.lines).toHaveLength(3);
    expect(v.total_debit).toBe(v.total_credit);

    // Bank gets net (900)
    const bankLine = v.lines.find(l => l.dr_cr === 'DR' && l.amount === '900.00');
    expect(bankLine).toBeDefined();
  });

  it('handles multiple dividends on same date for different securities', () => {
    const div1 = makeEvent({
      event_type: EventType.DIVIDEND,
      event_date: '2025-01-15',
      security_id: 'UNKNOWN:RELIANCE',
      gross_amount: '1000.00',
    });
    const tds1 = makeEvent({
      event_type: EventType.TDS_ON_DIVIDEND,
      event_date: '2025-01-15',
      security_id: 'UNKNOWN:RELIANCE',
      charge_type: 'TDS_ON_DIVIDEND',
      charge_amount: '100.00',
      gross_amount: '0',
    });
    const div2 = makeEvent({
      event_type: EventType.DIVIDEND,
      event_date: '2025-01-15',
      security_id: 'UNKNOWN:INFY',
      gross_amount: '500.00',
    });
    const tds2 = makeEvent({
      event_type: EventType.TDS_ON_DIVIDEND,
      event_date: '2025-01-15',
      security_id: 'UNKNOWN:INFY',
      charge_type: 'TDS_ON_DIVIDEND',
      charge_amount: '50.00',
      gross_amount: '0',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers([div1, tds1, div2, tds2], DEFAULT_PROFILE, tracker);

    expect(vouchers).toHaveLength(2);
    // Both should be balanced
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
  });
});

// ---------------------------------------------------------------------------
// buildCanonicalEvents — funds-statement dedup
// ---------------------------------------------------------------------------

describe('buildCanonicalEvents funds-statement dividend dedup', () => {
  it('skips funds-statement dividends when dividendRows are provided', () => {
    const fundsRows = [
      {
        posting_date: '2025-01-15',
        segment: 'EQ',
        description: 'Dividend received from RELIANCE',
        debit: '0',
        credit: '900',
        running_balance: '900',
        instrument: 'RELIANCE',
      },
    ];
    const dividendRows = [makeDividendRow()];

    const events = buildCanonicalEvents({
      fundsRows,
      dividendRows,
      batchId: 'batch-1',
      fileIds: { fundsStatement: 'fs-1', dividends: 'div-1' },
    });

    // Should have dividend events from dividendRows only (not from funds)
    const divEvents = events.filter(e => e.event_type === EventType.DIVIDEND);
    expect(divEvents).toHaveLength(1);
    expect(divEvents[0].gross_amount).toBe('1000.00'); // gross, not net
    expect(divEvents[0].source_file_id).toBe('div-1');
  });

  it('keeps funds-statement dividends when no dividendRows', () => {
    const fundsRows = [
      {
        posting_date: '2025-01-15',
        segment: 'EQ',
        description: 'Dividend received from RELIANCE',
        debit: '0',
        credit: '900',
        running_balance: '900',
        instrument: 'RELIANCE',
      },
    ];

    const events = buildCanonicalEvents({
      fundsRows,
      batchId: 'batch-1',
      fileIds: { fundsStatement: 'fs-1' },
    });

    const divEvents = events.filter(e => e.event_type === EventType.DIVIDEND);
    expect(divEvents).toHaveLength(1);
    expect(divEvents[0].gross_amount).toBe('900.00'); // net amount from funds
  });
});

// ---------------------------------------------------------------------------
// checkDividendTdsReconciliation
// ---------------------------------------------------------------------------

describe('checkDividendTdsReconciliation', () => {
  it('PASSED when event totals match raw rows', () => {
    const row = makeDividendRow(); // gross=1000, net=900, tds=100
    const events = dividendRowToEvents(row, 'batch-1', 'file-1');

    const check = checkDividendTdsReconciliation(events, [row]);
    expect(check.status).toBe('PASSED');
    expect(check.check_name).toBe('DIVIDEND_TDS_RECONCILIATION');
  });

  it('FAILED when TDS amount mismatches', () => {
    const row = makeDividendRow(); // gross=1000, tds=100
    const events = dividendRowToEvents(row, 'batch-1', 'file-1');

    // Tamper: change the TDS charge amount
    const tdsEvent = events.find(e => e.event_type === EventType.TDS_ON_DIVIDEND);
    if (tdsEvent) tdsEvent.charge_amount = '50.00';

    const check = checkDividendTdsReconciliation(events, [row]);
    expect(check.status).toBe('FAILED');
  });

  it('PASSED for empty dividend rows', () => {
    const check = checkDividendTdsReconciliation([], []);
    expect(check.status).toBe('PASSED');
  });
});
