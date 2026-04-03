import { describe, expect, it } from 'vitest';
import {
  checkTradeTotals,
  checkVoucherBalance,
  checkHoldingsReconciliation,
  checkDuplicateEvents,
  checkChargeCompleteness,
  checkDividendTdsReconciliation,
  checkMtfExposureWarning,
  runFullReconciliation,
} from '../checks';
import { TradeClassification } from '../../engine/trade-classifier';
import { EventType } from '../../types/events';
import { makeBuyEvent, makeSellEvent, makeChargeEvent, makeVoucherDraft, makeDividendRow } from '../../../tests/helpers/factories';

describe('checkTradeTotals', () => {
  it('PASSED when totals match', () => {
    const events = [
      makeBuyEvent({ gross_amount: '25000.00' }),
      makeSellEvent({ gross_amount: '26000.00' }),
    ];
    const rawRows = [
      { gross_amount: '25000.00' },
      { gross_amount: '26000.00' },
    ];
    const result = checkTradeTotals(events, rawRows);
    expect(result.status).toBe('PASSED');
  });

  it('FAILED when totals mismatch', () => {
    const events = [makeBuyEvent({ gross_amount: '25000.00' })];
    const rawRows = [{ gross_amount: '30000.00' }];
    const result = checkTradeTotals(events, rawRows);
    expect(result.status).toBe('FAILED');
    expect(result.difference).toBe('5000.00');
  });

  it('WARNING when raw rows lack recognisable amount fields', () => {
    const events = [makeBuyEvent({ gross_amount: '25000.00' })];
    const rawRows = [{ some_other_field: 'abc' }];
    const result = checkTradeTotals(events, rawRows);
    expect(result.status).toBe('WARNING');
  });

  it('tries multiple field names (value, amount)', () => {
    const events = [makeBuyEvent({ gross_amount: '25000.00' })];
    const rawRows = [{ value: '25000.00' }];
    expect(checkTradeTotals(events, rawRows).status).toBe('PASSED');

    const rawRows2 = [{ amount: '25000.00' }];
    expect(checkTradeTotals(events, rawRows2).status).toBe('PASSED');
  });

  it('skips non-numeric raw values gracefully', () => {
    const events = [makeBuyEvent({ gross_amount: '25000.00' })];
    const rawRows = [
      { gross_amount: 'not-a-number' },
      { gross_amount: '25000.00' },
    ];
    const result = checkTradeTotals(events, rawRows);
    expect(result.status).toBe('PASSED');
  });

  it('handles empty inputs', () => {
    const result = checkTradeTotals([], []);
    expect(result.status).toBe('WARNING');
  });
});

describe('checkVoucherBalance', () => {
  it('PASSED when all vouchers balanced', () => {
    const vouchers = [
      makeVoucherDraft({ total_debit: '25000.00', total_credit: '25000.00' }),
    ];
    expect(checkVoucherBalance(vouchers).status).toBe('PASSED');
  });

  it('FAILED when voucher is unbalanced', () => {
    const vouchers = [
      makeVoucherDraft({ total_debit: '25000.00', total_credit: '24000.00' }),
    ];
    const result = checkVoucherBalance(vouchers);
    expect(result.status).toBe('FAILED');
    expect(result.difference).toBe('1000.00');
  });

  it('PASSED for empty vouchers array', () => {
    expect(checkVoucherBalance([]).status).toBe('PASSED');
  });
});

describe('checkHoldingsReconciliation', () => {
  it('PASSED when no trade events', () => {
    const result = checkHoldingsReconciliation([], []);
    expect(result.status).toBe('PASSED');
  });

  it('WARNING when no holdings rows provided', () => {
    const events = [makeBuyEvent({ security_id: 'NSE:RELIANCE' })];
    const result = checkHoldingsReconciliation(events, []);
    expect(result.status).toBe('WARNING');
  });

  it('PASSED when holdings match with closing_quantity', () => {
    const events = [
      makeBuyEvent({ security_id: 'NSE:RELIANCE', quantity: '10' }),
    ];
    const holdingsRows = [
      { security_id: 'NSE:RELIANCE', quantity: '0', closing_quantity: '10' },
    ];
    const result = checkHoldingsReconciliation(events, holdingsRows);
    expect(result.status).toBe('PASSED');
  });

  it('FAILED when closing quantity mismatches', () => {
    const events = [
      makeBuyEvent({ security_id: 'NSE:RELIANCE', quantity: '10' }),
    ];
    const holdingsRows = [
      { security_id: 'NSE:RELIANCE', quantity: '0', closing_quantity: '5' },
    ];
    const result = checkHoldingsReconciliation(events, holdingsRows);
    expect(result.status).toBe('FAILED');
  });
});

describe('checkDuplicateEvents', () => {
  it('PASSED when all hashes unique', () => {
    const events = [
      makeBuyEvent({ event_hash: 'hash1' }),
      makeBuyEvent({ event_hash: 'hash2' }),
    ];
    expect(checkDuplicateEvents(events).status).toBe('PASSED');
  });

  it('WARNING for 1-3 duplicate hashes', () => {
    const events = [
      makeBuyEvent({ event_hash: 'hash1' }),
      makeBuyEvent({ event_hash: 'hash1' }),
      makeBuyEvent({ event_hash: 'hash2' }),
    ];
    const result = checkDuplicateEvents(events);
    expect(result.status).toBe('WARNING');
  });

  it('FAILED for >3 distinct duplicate hashes', () => {
    const events = [
      makeBuyEvent({ event_hash: 'h1' }), makeBuyEvent({ event_hash: 'h1' }),
      makeBuyEvent({ event_hash: 'h2' }), makeBuyEvent({ event_hash: 'h2' }),
      makeBuyEvent({ event_hash: 'h3' }), makeBuyEvent({ event_hash: 'h3' }),
      makeBuyEvent({ event_hash: 'h4' }), makeBuyEvent({ event_hash: 'h4' }),
    ];
    expect(checkDuplicateEvents(events).status).toBe('FAILED');
  });

  it('PASSED for empty events', () => {
    expect(checkDuplicateEvents([]).status).toBe('PASSED');
  });
});

describe('checkChargeCompleteness', () => {
  it('PASSED when STT exists for trades by contract_note_ref', () => {
    const cnRef = 'CN001';
    const events = [
      makeBuyEvent({ contract_note_ref: cnRef }),
      makeChargeEvent(EventType.STT, '2.50', 'NSE:RELIANCE', { contract_note_ref: cnRef }),
    ];
    expect(checkChargeCompleteness(events).status).toBe('PASSED');
  });

  it('PASSED when STT matches by date+security', () => {
    const events = [
      makeBuyEvent({ event_date: '2024-06-15', security_id: 'NSE:RELIANCE', contract_note_ref: null }),
      makeChargeEvent(EventType.STT, '2.50', 'NSE:RELIANCE', {
        event_date: '2024-06-15',
        contract_note_ref: null,
      }),
    ];
    expect(checkChargeCompleteness(events).status).toBe('PASSED');
  });

  it('WARNING when STT missing for a trade', () => {
    const events = [
      makeBuyEvent({ contract_note_ref: null, event_date: '2024-06-15', security_id: 'NSE:RELIANCE' }),
    ];
    const result = checkChargeCompleteness(events);
    expect(result.status).toBe('WARNING');
  });

  it('PASSED for empty events', () => {
    expect(checkChargeCompleteness([]).status).toBe('PASSED');
  });
});

describe('checkDividendTdsReconciliation', () => {
  it('PASSED when amounts match', () => {
    const rows = [makeDividendRow({ quantity: '100', dividend_per_share: '10', net_dividend_amount: '900' })];
    const events = [
      makeBuyEvent({
        event_type: EventType.DIVIDEND,
        gross_amount: '1000.00',
        quantity: '100',
        rate: '10',
      }),
      makeChargeEvent(EventType.TDS_ON_DIVIDEND, '100.00'),
    ];
    expect(checkDividendTdsReconciliation(events, rows).status).toBe('PASSED');
  });

  it('FAILED when amounts mismatch significantly', () => {
    const rows = [makeDividendRow({ quantity: '100', dividend_per_share: '10', net_dividend_amount: '900' })];
    const events = [
      makeBuyEvent({
        event_type: EventType.DIVIDEND,
        gross_amount: '500.00',
      }),
    ];
    expect(checkDividendTdsReconciliation(events, rows).status).toBe('FAILED');
  });

  it('PASSED for empty rows', () => {
    expect(checkDividendTdsReconciliation([], []).status).toBe('PASSED');
  });
});

describe('checkMtfExposureWarning', () => {
  it('returns WARNING when MTF trades are present', () => {
    const result = checkMtfExposureWarning([
      makeBuyEvent({
        trade_product: 'MTF',
        trade_classification: TradeClassification.INVESTMENT,
      }),
    ]);

    expect(result.status).toBe('WARNING');
    expect(result.details).toContain('MTF trade event');
  });

  it('returns PASSED when no MTF trades are present', () => {
    expect(checkMtfExposureWarning([makeBuyEvent()]).status).toBe('PASSED');
  });
});

describe('runFullReconciliation', () => {
  it('returns PASSED when all checks pass', () => {
    // Provide holdings so checkHoldingsReconciliation doesn't return WARNING
    const events = [makeBuyEvent({ gross_amount: '25000.00', contract_note_ref: 'CN1', security_id: 'NSE:RELIANCE', quantity: '10' })];
    const sttEvent = makeChargeEvent(EventType.STT, '2.50', 'NSE:RELIANCE', { contract_note_ref: 'CN1' });
    const result = runFullReconciliation({
      events: [...events, sttEvent],
      vouchers: [makeVoucherDraft()],
      rawTradebookRows: [{ gross_amount: '25000.00' }],
      holdingsRows: [{ security_id: 'NSE:RELIANCE', quantity: '0', closing_quantity: '10' }],
    });
    expect(result.overall_status).toBe('PASSED');
    expect(result.mismatch_count).toBe(0);
  });

  it('returns FAILED when any check fails', () => {
    const result = runFullReconciliation({
      events: [makeBuyEvent({ gross_amount: '25000.00' })],
      vouchers: [makeVoucherDraft({ total_debit: '25000', total_credit: '20000' })],
      rawTradebookRows: [{ gross_amount: '25000.00' }],
    });
    expect(result.overall_status).toBe('FAILED');
    expect(result.mismatch_count).toBeGreaterThan(0);
  });

  it('includes CN checks only when contractNoteCharges provided', () => {
    const result = runFullReconciliation({
      events: [],
      vouchers: [],
    });
    const checkNames = result.checks.map(c => c.check_name);
    expect(checkNames).not.toContain('CN_CHARGE_RECONCILIATION');
    expect(checkNames).not.toContain('TRADE_MATCH');
  });

  it('includes dividend TDS check when rawDividendRows provided', () => {
    const result = runFullReconciliation({
      events: [],
      vouchers: [],
      rawDividendRows: [makeDividendRow()],
    });
    const checkNames = result.checks.map(c => c.check_name);
    expect(checkNames).toContain('DIVIDEND_TDS_RECONCILIATION');
  });

  it('includes MTF review check when MTF trade is present', () => {
    const result = runFullReconciliation({
      events: [makeBuyEvent({ trade_product: 'MTF' })],
      vouchers: [],
    });

    const mtfCheck = result.checks.find(c => c.check_name === 'MTF_REVIEW');
    expect(mtfCheck?.status).toBe('WARNING');
  });

  it('overall_status priority: FAILED > WARNING > PASSED', () => {
    // This should have WARNING from missing STT + FAILED from trade total mismatch
    const result = runFullReconciliation({
      events: [makeBuyEvent({ gross_amount: '25000.00' })],
      vouchers: [],
      rawTradebookRows: [{ gross_amount: '30000.00' }],
    });
    expect(result.overall_status).toBe('FAILED');
  });
});
