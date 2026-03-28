import { describe, expect, it } from 'vitest';
import { checkContractNoteChargeReconciliation, checkTradeMatch } from '../checks';
import { EventType, type CanonicalEvent } from '../../types/events';
import type { ZerodhaContractNoteCharges } from '../../parsers/zerodha/types';
import type { TradeMatchResult } from '../../engine/trade-matcher';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChargeEvent(
  chargeType: string,
  eventType: EventType,
  amount: string,
  cnRef = 'CN-001',
): CanonicalEvent {
  return {
    event_id: crypto.randomUUID(),
    import_batch_id: 'batch-1',
    event_type: eventType,
    event_date: '2024-01-15',
    settlement_date: null,
    security_id: 'NSE:RELIANCE',
    quantity: '0',
    rate: '0',
    gross_amount: '0',
    charge_type: chargeType,
    charge_amount: amount,
    source_file_id: 'file-1',
    source_row_ids: ['T1'],
    contract_note_ref: cnRef,
    external_ref: 'T1',
    event_hash: crypto.randomUUID(),
  };
}

function makeCnCharges(overrides: Partial<ZerodhaContractNoteCharges> = {}): ZerodhaContractNoteCharges {
  return {
    contract_note_no: 'CN-001',
    trade_date: '15-01-2024',
    settlement_no: 'S-001',
    pay_in_pay_out: '25000.00',
    brokerage: '10.00',
    exchange_charges: '5.00',
    clearing_charges: '1.00',
    cgst: '0.90',
    sgst: '0.90',
    igst: '0',
    stt: '25.00',
    sebi_fees: '0.25',
    stamp_duty: '3.75',
    net_amount: '24953.20',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// checkContractNoteChargeReconciliation
// ---------------------------------------------------------------------------

describe('checkContractNoteChargeReconciliation', () => {
  it('passes when allocated charges match aggregate', () => {
    const charges = [makeCnCharges({ stt: '25.00', exchange_charges: '5.00', sebi_fees: '0.25', stamp_duty: '3.75', cgst: '0.90', sgst: '0.90', igst: '0' })];
    const events: CanonicalEvent[] = [
      makeChargeEvent('STT', EventType.STT, '25.00'),
      makeChargeEvent('EXCHANGE_CHARGE', EventType.EXCHANGE_CHARGE, '5.00'),
      makeChargeEvent('CLEARING_CHARGE', EventType.EXCHANGE_CHARGE, '1.00'),
      makeChargeEvent('SEBI_CHARGE', EventType.SEBI_CHARGE, '0.25'),
      makeChargeEvent('STAMP_DUTY', EventType.STAMP_DUTY, '3.75'),
      makeChargeEvent('GST_ON_CHARGES', EventType.GST_ON_CHARGES, '1.80'),
    ];

    const result = checkContractNoteChargeReconciliation(events, charges);
    expect(result.status).toBe('PASSED');
  });

  it('fails when charges mismatch', () => {
    const charges = [makeCnCharges({ stt: '25.00' })];
    const events: CanonicalEvent[] = [
      makeChargeEvent('STT', EventType.STT, '20.00'), // mismatch: 20 vs 25
      makeChargeEvent('EXCHANGE_CHARGE', EventType.EXCHANGE_CHARGE, '5.00'),
      makeChargeEvent('CLEARING_CHARGE', EventType.EXCHANGE_CHARGE, '1.00'),
      makeChargeEvent('SEBI_CHARGE', EventType.SEBI_CHARGE, '0.25'),
      makeChargeEvent('STAMP_DUTY', EventType.STAMP_DUTY, '3.75'),
      makeChargeEvent('GST_ON_CHARGES', EventType.GST_ON_CHARGES, '1.80'),
    ];

    const result = checkContractNoteChargeReconciliation(events, charges);
    expect(result.status).toBe('FAILED');
    expect(result.details).toContain('STT');
  });

  it('passes with empty charges', () => {
    const result = checkContractNoteChargeReconciliation([], []);
    expect(result.status).toBe('PASSED');
  });
});

// ---------------------------------------------------------------------------
// checkTradeMatch
// ---------------------------------------------------------------------------

describe('checkTradeMatch', () => {
  it('passes at 100% match rate', () => {
    const matchResult: TradeMatchResult = {
      matched: [
        { tradebookRow: {} as never, contractNoteRow: {} as never, match_confidence: 'EXACT' },
      ],
      unmatchedTradebook: [],
      unmatchedContractNote: [],
    };

    const result = checkTradeMatch(matchResult);
    expect(result.status).toBe('PASSED');
  });

  it('warns at 95% match rate', () => {
    const matched = Array.from({ length: 19 }, () => ({
      tradebookRow: {} as never,
      contractNoteRow: {} as never,
      match_confidence: 'EXACT' as const,
    }));

    const matchResult: TradeMatchResult = {
      matched,
      unmatchedTradebook: [{} as never], // 1 unmatched out of 20
      unmatchedContractNote: [],
    };

    const result = checkTradeMatch(matchResult);
    expect(result.status).toBe('WARNING');
  });

  it('fails at <90% match rate', () => {
    const matched = Array.from({ length: 8 }, () => ({
      tradebookRow: {} as never,
      contractNoteRow: {} as never,
      match_confidence: 'EXACT' as const,
    }));

    const matchResult: TradeMatchResult = {
      matched,
      unmatchedTradebook: [{} as never, {} as never, {} as never], // 3 unmatched out of 11
      unmatchedContractNote: [],
    };

    const result = checkTradeMatch(matchResult);
    expect(result.status).toBe('FAILED');
  });

  it('passes with no trades', () => {
    const result = checkTradeMatch({ matched: [], unmatchedTradebook: [], unmatchedContractNote: [] });
    expect(result.status).toBe('PASSED');
  });
});
