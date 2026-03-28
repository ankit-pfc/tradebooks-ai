import { describe, expect, it } from 'vitest';
import { EventType, type CanonicalEvent } from '../../lib/types/events';
import { INVESTOR_DEFAULT, INVESTOR_TALLY_DEFAULT, TRADER_TALLY_DEFAULT } from '../../lib/engine/accounting-policy';
import { collectRequiredLedgers } from '../../lib/export/ledger-masters';

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
    charge_type: null,
    charge_amount: '0',
    source_file_id: 'file-test',
    source_row_ids: [],
    contract_note_ref: null,
    external_ref: null,
    event_hash: 'test-hash',
    ...overrides,
  };
}

describe('collectRequiredLedgers with TallyProfile', () => {
  const events: CanonicalEvent[] = [
    makeEvent({ event_type: EventType.BUY_TRADE, security_id: 'NSE:RELIANCE' }),
    makeEvent({ event_type: EventType.SELL_TRADE, security_id: 'NSE:RELIANCE', quantity: '-5', gross_amount: '13000.00' }),
    makeEvent({ event_type: EventType.BUY_TRADE, security_id: 'NSE:INFY' }),
    makeEvent({ event_type: EventType.DIVIDEND, security_id: 'NSE:TCS', gross_amount: '500.00' }),
  ];

  it('returns Capital Account ledger names with INVESTOR_TALLY_DEFAULT', () => {
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT, {
      tallyProfile: INVESTOR_TALLY_DEFAULT,
    });

    const names = ledgers.map(l => l.name);

    // Investment ledgers: per-scrip {symbol}-SH
    expect(names).toContain('RELIANCE-SH');
    expect(names).toContain('INFY-SH');

    // Broker
    expect(names).toContain(INVESTOR_TALLY_DEFAULT.broker.name);
    expect(names).toContain(INVESTOR_TALLY_DEFAULT.bank.name);

    // Per-scrip capital gain ledgers for RELIANCE (the sell symbol)
    expect(names).toContain('STCG ON RELIANCE');
    expect(names).toContain('LTCG ON RELIANCE');
    expect(names).toContain('STCL ON RELIANCE');
    expect(names).toContain('LTCL ON RELIANCE');

    // Per-scrip dividend ledger
    expect(names).toContain('DIV TCS');

    // Consolidated charge ledgers
    for (const cc of INVESTOR_TALLY_DEFAULT.chargeConsolidation) {
      expect(names).toContain(cc.ledgerName);
    }

    // TDS ledgers
    expect(names).toContain(INVESTOR_TALLY_DEFAULT.tdsOnDividend.name);
    expect(names).toContain(INVESTOR_TALLY_DEFAULT.tdsOnSecurities.name);
  });

  it('returns pooled ledger names with TRADER_TALLY_DEFAULT', () => {
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT, {
      tallyProfile: TRADER_TALLY_DEFAULT,
    });

    const names = ledgers.map(l => l.name);

    // Investment ledgers: per-scrip Shares-in-Trade pattern
    expect(names).toContain('Shares-in-Trade - RELIANCE');
    expect(names).toContain('Shares-in-Trade - INFY');

    // Pooled gain ledgers (not per-scrip)
    expect(names).toContain(TRADER_TALLY_DEFAULT.stcg.template);
    expect(names).toContain(TRADER_TALLY_DEFAULT.ltcg.template);
  });

  it('returns no duplicates', () => {
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT, {
      tallyProfile: INVESTOR_TALLY_DEFAULT,
    });

    const names = ledgers.map(l => l.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('falls back to hardcoded names without TallyProfile (backward compat)', () => {
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT);
    const names = ledgers.map(l => l.name);

    // Old-style investment ledger names
    expect(names).toContain('Investment in Equity Shares - NSE:RELIANCE');
    expect(names).toContain('Investment in Equity Shares - NSE:INFY');

    // Old-style P&L ledgers
    expect(names).toContain('Short Term Capital Gain on Sale of Shares');
    expect(names).toContain('Short Term Capital Loss on Sale of Shares');
  });

  it('includes speculation ledgers when sells are present', () => {
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT, {
      tallyProfile: INVESTOR_TALLY_DEFAULT,
    });
    const names = ledgers.map(l => l.name);

    expect(names).toContain(INVESTOR_TALLY_DEFAULT.speculationGain.name);
    expect(names).toContain(INVESTOR_TALLY_DEFAULT.speculationLoss.name);
  });

  it('handles events with no security_id gracefully', () => {
    const bankEvents: CanonicalEvent[] = [
      makeEvent({ event_type: EventType.BANK_RECEIPT, security_id: null }),
    ];

    const ledgers = collectRequiredLedgers(bankEvents, INVESTOR_DEFAULT, {
      tallyProfile: INVESTOR_TALLY_DEFAULT,
    });

    // Should still have broker + bank at minimum
    const names = ledgers.map(l => l.name);
    expect(names).toContain(INVESTOR_TALLY_DEFAULT.broker.name);
    expect(names).toContain(INVESTOR_TALLY_DEFAULT.bank.name);
  });
});
