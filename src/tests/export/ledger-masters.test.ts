import { describe, expect, it } from 'vitest';
import { collectRequiredLedgers } from '../../lib/export/ledger-masters';
import { INVESTOR_DEFAULT, TRADER_DEFAULT } from '../../lib/engine/accounting-policy';
import { LedgerStrategy } from '../../lib/types/accounting';
import { makeBuyEvent, makeSellEvent } from '../helpers/factories';
import { TradeClassification } from '../../lib/engine/trade-classifier';

describe('collectRequiredLedgers — no TallyProfile', () => {
  it('always includes broker and bank ledgers', () => {
    const ledgers = collectRequiredLedgers([], INVESTOR_DEFAULT);
    const names = ledgers.map(l => l.name);
    expect(names).toContain('Zerodha Broking');
    expect(names).toContain('Bank Account');
  });

  it('always includes all charge ledgers', () => {
    const ledgers = collectRequiredLedgers([], INVESTOR_DEFAULT);
    const names = ledgers.map(l => l.name);
    expect(names).toContain('Brokerage');
    expect(names).toContain('Securities Transaction Tax');
    expect(names).toContain('Exchange Transaction Charges');
    expect(names).toContain('SEBI Turnover Fees');
    expect(names).toContain('GST on Brokerage');
    expect(names).toContain('Stamp Duty');
    expect(names).toContain('DP Charges');
  });

  it('INVESTOR + SCRIPT_LEVEL produces per-script investment ledgers', () => {
    const events = [
      makeBuyEvent({ security_id: 'NSE:RELIANCE' }),
      makeSellEvent({ security_id: 'NSE:TCS' }),
    ];
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT);
    const names = ledgers.map(l => l.name);
    expect(names).toContain('Investment in Equity Shares - NSE:RELIANCE');
    expect(names).toContain('Investment in Equity Shares - NSE:TCS');
    // Investment ledgers must have affects_stock=true (Bug 1 fix)
    const investmentLedger = ledgers.find(l => l.name.includes('Investment in Equity'));
    expect(investmentLedger?.affects_stock).toBe(true);
  });

  it('TRADER + SCRIPT_LEVEL produces per-script stock-in-trade with affects_stock=true', () => {
    const events = [makeBuyEvent({ security_id: 'NSE:RELIANCE' })];
    const ledgers = collectRequiredLedgers(events, TRADER_DEFAULT);
    const stockLedger = ledgers.find(l => l.name.includes('Shares-in-Trade'));
    expect(stockLedger).toBeDefined();
    expect(stockLedger?.affects_stock).toBe(true);
  });

  it('INVESTOR + POOLED uses single pooled investment ledger', () => {
    const profile = { ...INVESTOR_DEFAULT, ledger_strategy: LedgerStrategy.POOLED };
    const events = [makeBuyEvent()];
    const ledgers = collectRequiredLedgers(events, profile);
    const names = ledgers.map(l => l.name);
    expect(names.some(n => n.includes('Pooled') || n.includes('Investment'))).toBe(true);
    // Should NOT have per-script ledgers
    expect(names.filter(n => n.includes('NSE:RELIANCE'))).toHaveLength(0);
  });

  it('INVESTOR includes STCG/LTCG profit/loss + speculation + dividend P&L ledgers', () => {
    const ledgers = collectRequiredLedgers([], INVESTOR_DEFAULT);
    const names = ledgers.map(l => l.name);
    expect(names).toContain('Short Term Capital Gain on Sale of Shares');
    expect(names).toContain('Short Term Capital Loss on Sale of Shares');
    expect(names).toContain('Long Term Capital Gain on Sale of Shares');
    expect(names).toContain('Long Term Capital Loss on Sale of Shares');
    expect(names).toContain('Speculative Profit on Shares');
    expect(names).toContain('Speculative Loss on Shares');
    expect(names).toContain('Dividend Income');
  });

  it('TRADER includes Trading Sales + Cost of Shares Sold + Dividend Income', () => {
    const ledgers = collectRequiredLedgers([], TRADER_DEFAULT);
    const names = ledgers.map(l => l.name);
    expect(names).toContain('Trading Sales');
    expect(names).toContain('Cost of Shares Sold');
    expect(names).toContain('Dividend Income');
  });

  it('deduplicates when same security appears in multiple events', () => {
    const events = [
      makeBuyEvent({ security_id: 'NSE:RELIANCE' }),
      makeBuyEvent({ security_id: 'NSE:RELIANCE' }),
      makeSellEvent({ security_id: 'NSE:RELIANCE' }),
    ];
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT);
    const investmentLedgers = ledgers.filter(l =>
      l.name.includes('Investment in Equity Shares - NSE:RELIANCE'),
    );
    expect(investmentLedgers).toHaveLength(1);
  });

  it('handles null security_id gracefully', () => {
    const events = [makeBuyEvent({ security_id: null })];
    // Should not throw
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT);
    // Should still have base ledgers
    expect(ledgers.length).toBeGreaterThan(0);
  });

  it('includes both investor and trader ledger families for mixed-classification batches', () => {
    const events = [
      makeBuyEvent({
        security_id: 'NSE:RELIANCE',
        trade_classification: TradeClassification.INVESTMENT,
      }),
      makeBuyEvent({
        security_id: 'NSE:TCS',
        trade_classification: TradeClassification.NON_SPECULATIVE_BUSINESS,
      }),
    ];

    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT);
    const names = ledgers.map(l => l.name);

    expect(names).toContain('Investment in Equity Shares - NSE:RELIANCE');
    expect(names).toContain('Shares-in-Trade - NSE:TCS');
    expect(names).toContain('Trading Sales');
    expect(names).toContain('Short Term Capital Gain on Sale of Shares');
  });
});
