import { describe, it, expect } from 'vitest';
import {
  resolveTemplate,
  resolveInvestmentLedger,
  resolveGainLedger,
  resolveCapitalGainLedger,
  resolveDividendLedger,
  resolveChargeLedger,
  classifyGain,
  collectProfileLedgers,
} from '../../lib/engine/ledger-resolver';
import {
  INVESTOR_TALLY_DEFAULT,
  TRADER_TALLY_DEFAULT,
} from '../../lib/engine/accounting-policy';
import { EventType } from '../../lib/types/events';

describe('resolveTemplate', () => {
  it('substitutes {symbol} token', () => {
    const result = resolveTemplate(
      { template: 'STCG ON {symbol}', group: 'STCG' },
      'RELIANCE',
    );
    expect(result.name).toBe('STCG ON RELIANCE');
    expect(result.group).toBe('STCG');
  });

  it('handles templates without {symbol}', () => {
    const result = resolveTemplate(
      { template: 'Fixed Ledger Name', group: 'Some Group' },
      'INFY',
    );
    expect(result.name).toBe('Fixed Ledger Name');
  });

  it('handles multiple {symbol} occurrences', () => {
    const result = resolveTemplate(
      { template: '{symbol} - Investment in {symbol}', group: 'Test' },
      'TCS',
    );
    expect(result.name).toBe('TCS - Investment in TCS');
  });
});

describe('resolveInvestmentLedger', () => {
  it('investor default: {symbol}-SH under INVESTMENT IN SHARES-ZERODHA', () => {
    const result = resolveInvestmentLedger(INVESTOR_TALLY_DEFAULT, 'RELIANCE');
    expect(result.name).toBe('RELIANCE-SH');
    expect(result.group).toBe('INVESTMENT IN SHARES-ZERODHA');
  });

  it('trader default: Shares-in-Trade - {symbol}', () => {
    const result = resolveInvestmentLedger(TRADER_TALLY_DEFAULT, 'TCS');
    expect(result.name).toBe('Shares-in-Trade - TCS');
    expect(result.group).toBe('Stock-in-Hand');
  });
});

describe('classifyGain', () => {
  it('holdingPeriodDays === 0 → SPECULATION', () => {
    expect(classifyGain(0, true)).toBe('SPECULATION');
    expect(classifyGain(0, false)).toBe('SPECULATION');
  });

  it('holdingPeriodDays 1-365 → STCG/STCL', () => {
    expect(classifyGain(1, true)).toBe('STCG');
    expect(classifyGain(365, true)).toBe('STCG');
    expect(classifyGain(100, false)).toBe('STCL');
  });

  it('holdingPeriodDays > 365 → LTCG/LTCL', () => {
    expect(classifyGain(366, true)).toBe('LTCG');
    expect(classifyGain(1000, true)).toBe('LTCG');
    expect(classifyGain(400, false)).toBe('LTCL');
  });

  it('undefined holdingPeriodDays → STCG/STCL', () => {
    expect(classifyGain(undefined, true)).toBe('STCG');
    expect(classifyGain(undefined, false)).toBe('STCL');
  });
});

describe('resolveGainLedger', () => {
  it('investor per-scrip STCG', () => {
    const result = resolveGainLedger(INVESTOR_TALLY_DEFAULT, 'STCG', 'INFY');
    expect(result.name).toBe('STCG ON INFY');
    expect(result.group).toBe('STCG');
  });

  it('investor per-scrip LTCG', () => {
    const result = resolveGainLedger(INVESTOR_TALLY_DEFAULT, 'LTCG', 'TCS');
    expect(result.name).toBe('LTCG ON TCS');
    expect(result.group).toBe('LTCG');
  });

  it('investor per-scrip STCL', () => {
    const result = resolveGainLedger(INVESTOR_TALLY_DEFAULT, 'STCL', 'WIPRO');
    expect(result.name).toBe('STCL ON WIPRO');
    expect(result.group).toBe('STCL');
  });

  it('investor per-scrip LTCL', () => {
    const result = resolveGainLedger(INVESTOR_TALLY_DEFAULT, 'LTCL', 'SBIN');
    expect(result.name).toBe('LTCL ON SBIN');
    expect(result.group).toBe('LTCL');
  });

  it('trader pooled gain (no per-scrip)', () => {
    const result = resolveGainLedger(TRADER_TALLY_DEFAULT, 'STCG', 'INFY');
    expect(result.name).toBe('Short Term Capital Gain on Sale of Shares');
    expect(result.group).toBe('Indirect Incomes');
  });
});

describe('resolveCapitalGainLedger', () => {
  it('intraday → speculation gain', () => {
    const result = resolveCapitalGainLedger(
      INVESTOR_TALLY_DEFAULT,
      'RELIANCE',
      0,
      true,
    );
    expect(result.name).toBe('Intraday Gain on Sale of Shares - ZERODHA');
    expect(result.group).toBe('Speculative Business Income');
  });

  it('intraday → routes losses to the SAME ledger as gains (single net ledger)', () => {
    // Per bug report items #12/#13: intraday gains and losses must net off in
    // the same Tally ledger. Loss postings hit the gain ledger as DR-side
    // entries instead of routing to a separate loss ledger.
    const result = resolveCapitalGainLedger(
      INVESTOR_TALLY_DEFAULT,
      'RELIANCE',
      0,
      false,
    );
    expect(result.name).toBe('Intraday Gain on Sale of Shares - ZERODHA');
  });

  it('short term gain → per-scrip STCG', () => {
    const result = resolveCapitalGainLedger(
      INVESTOR_TALLY_DEFAULT,
      'INFY',
      200,
      true,
    );
    expect(result.name).toBe('STCG ON INFY');
  });

  it('long term loss → per-scrip LTCL', () => {
    const result = resolveCapitalGainLedger(
      INVESTOR_TALLY_DEFAULT,
      'TCS',
      500,
      false,
    );
    expect(result.name).toBe('LTCL ON TCS');
  });
});

describe('resolveDividendLedger', () => {
  it('investor per-scrip dividends', () => {
    const result = resolveDividendLedger(INVESTOR_TALLY_DEFAULT, 'HDFC BANK');
    expect(result.name).toBe('DIV HDFC BANK');
    expect(result.group).toBe('Div on Shares');
  });

  it('trader pooled dividends', () => {
    const result = resolveDividendLedger(TRADER_TALLY_DEFAULT, 'INFY');
    expect(result.name).toBe('Dividend Income');
    expect(result.group).toBe('Indirect Incomes');
  });
});

describe('resolveChargeLedger', () => {
  it('brokerage → SHARE BROKERAGE (investor)', () => {
    const result = resolveChargeLedger(
      INVESTOR_TALLY_DEFAULT,
      EventType.BROKERAGE,
    );
    expect(result.name).toBe('SHARE BROKERAGE');
    expect(result.group).toBe('Capital Account');
  });

  it('STT → Stt (investor)', () => {
    const result = resolveChargeLedger(INVESTOR_TALLY_DEFAULT, EventType.STT);
    expect(result.name).toBe('Stt');
    expect(result.group).toBe('Capital Account');
  });

  it('exchange charge consolidates to Exchange and Other Charges', () => {
    const result = resolveChargeLedger(
      INVESTOR_TALLY_DEFAULT,
      EventType.EXCHANGE_CHARGE,
    );
    expect(result.name).toBe('Exchange and Other Charges');
  });

  it('SEBI charge consolidates to same ledger as exchange charge', () => {
    const exchange = resolveChargeLedger(
      INVESTOR_TALLY_DEFAULT,
      EventType.EXCHANGE_CHARGE,
    );
    const sebi = resolveChargeLedger(
      INVESTOR_TALLY_DEFAULT,
      EventType.SEBI_CHARGE,
    );
    expect(exchange.name).toBe(sebi.name);
  });

  it('GST stays in Duties & Taxes', () => {
    const result = resolveChargeLedger(
      INVESTOR_TALLY_DEFAULT,
      EventType.GST_ON_CHARGES,
    );
    expect(result.group).toBe('Duties & Taxes');
  });

  it('DP charge → DP Charges-Zerodha', () => {
    const result = resolveChargeLedger(
      INVESTOR_TALLY_DEFAULT,
      EventType.DP_CHARGE,
    );
    expect(result.name).toBe('DP Charges-Zerodha');
    expect(result.group).toBe('Capital Account');
  });

  it('trader keeps itemized charges under Indirect Expenses', () => {
    const brokerage = resolveChargeLedger(
      TRADER_TALLY_DEFAULT,
      EventType.BROKERAGE,
    );
    expect(brokerage.name).toBe('Brokerage');
    expect(brokerage.group).toBe('Indirect Expenses');

    const stt = resolveChargeLedger(TRADER_TALLY_DEFAULT, EventType.STT);
    expect(stt.name).toBe('Securities Transaction Tax');
    expect(stt.group).toBe('Indirect Expenses');
  });

  it('unmapped charge type falls back to Other Charges', () => {
    const result = resolveChargeLedger(
      INVESTOR_TALLY_DEFAULT,
      EventType.AUCTION_ADJUSTMENT,
    );
    expect(result.name).toBe('Other Charges');
  });
});

describe('collectProfileLedgers', () => {
  it('includes broker, bank, and charge ledgers', () => {
    const { ledgers } = collectProfileLedgers(
      INVESTOR_TALLY_DEFAULT,
      [],
      [],
      [],
    );
    const names = ledgers.map((l) => l.name);
    expect(names).toContain('ZERODHA - KITE');
    expect(names).toContain('Bank Account');
    expect(names).toContain('SHARE BROKERAGE');
    expect(names).toContain('Stt');
  });

  it('generates per-scrip investment ledgers', () => {
    const { ledgers } = collectProfileLedgers(
      INVESTOR_TALLY_DEFAULT,
      ['RELIANCE', 'INFY'],
      [],
      [],
    );
    const names = ledgers.map((l) => l.name);
    expect(names).toContain('RELIANCE-SH');
    expect(names).toContain('INFY-SH');
  });

  it('generates per-scrip capital gain ledgers', () => {
    const { ledgers } = collectProfileLedgers(
      INVESTOR_TALLY_DEFAULT,
      ['INFY'],
      [
        { symbol: 'INFY', gainType: 'STCG' },
        { symbol: 'TCS', gainType: 'LTCL' },
      ],
      [],
    );
    const names = ledgers.map((l) => l.name);
    expect(names).toContain('STCG ON INFY');
    expect(names).toContain('LTCL ON TCS');
  });

  it('generates per-scrip dividend ledgers', () => {
    const { ledgers } = collectProfileLedgers(
      INVESTOR_TALLY_DEFAULT,
      [],
      [],
      ['HDFC BANK', 'ITC'],
    );
    const names = ledgers.map((l) => l.name);
    expect(names).toContain('DIV HDFC BANK');
    expect(names).toContain('DIV ITC');
  });

  it('includes custom groups from profile', () => {
    const { groups } = collectProfileLedgers(
      INVESTOR_TALLY_DEFAULT,
      [],
      [],
      [],
    );
    const groupNames = groups.map((g) => g.name);
    expect(groupNames).toContain('STCG');
    expect(groupNames).toContain('LTCG');
    expect(groupNames).toContain('INVESTMENT IN SHARES-ZERODHA');
  });

  it('includes TDS ledgers', () => {
    const { ledgers } = collectProfileLedgers(
      INVESTOR_TALLY_DEFAULT,
      [],
      [],
      [],
    );
    const names = ledgers.map((l) => l.name);
    expect(names).toContain('TDS ON DIVIDEND');
    expect(names).toContain('TDS on Securities');
  });

  it('de-duplicates ledger names', () => {
    const { ledgers } = collectProfileLedgers(
      INVESTOR_TALLY_DEFAULT,
      ['RELIANCE', 'RELIANCE'],
      [
        { symbol: 'INFY', gainType: 'STCG' },
        { symbol: 'INFY', gainType: 'STCG' },
      ],
      ['ITC', 'ITC'],
    );
    const names = ledgers.map((l) => l.name);
    const uniqueNames = [...new Set(names)];
    expect(names.length).toBe(uniqueNames.length);
  });
});
