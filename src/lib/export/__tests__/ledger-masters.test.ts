import { describe, expect, it } from 'vitest';
import { collectRequiredLedgers } from '../ledger-masters';
import { INVESTOR_DEFAULT, TRADER_DEFAULT, INVESTOR_TALLY_DEFAULT } from '../../engine/accounting-policy';
import { AccountingMode, LedgerStrategy } from '../../types/accounting';
import { EventType } from '../../types/events';
import { makeBuyEvent, makeSellEvent } from '../../../tests/helpers/factories';

// ---------------------------------------------------------------------------
// Bug 1 — investment ledgers must have affects_stock: true
// ---------------------------------------------------------------------------

describe('collectRequiredLedgers — non-TallyProfile path', () => {
  const buyEvent = makeBuyEvent({ security_id: 'NSE:RELIANCE' });
  const sellEvent = makeSellEvent({ security_id: 'NSE:RELIANCE' });
  const events = [buyEvent, sellEvent];

  it('INVESTOR script-level: investment ledger has affects_stock=true', () => {
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT);

    const assetLedger = ledgers.find(l => l.name.includes('RELIANCE'));
    expect(assetLedger).toBeDefined();
    expect(assetLedger!.affects_stock).toBe(true);
  });

  it('TRADER script-level: stock-in-trade ledger has affects_stock=true', () => {
    const ledgers = collectRequiredLedgers(events, TRADER_DEFAULT);

    const assetLedger = ledgers.find(l => l.name.includes('RELIANCE'));
    expect(assetLedger).toBeDefined();
    expect(assetLedger!.affects_stock).toBe(true);
  });

  it('INVESTOR pooled: pooled investment ledger has affects_stock=true', () => {
    const pooledProfile = { ...INVESTOR_DEFAULT, ledger_strategy: LedgerStrategy.POOLED };
    const ledgers = collectRequiredLedgers(events, pooledProfile);

    const pooledLedger = ledgers.find(l => l.name.includes('Investment'));
    expect(pooledLedger).toBeDefined();
    expect(pooledLedger!.affects_stock).toBe(true);
  });

  it('broker/bank/charge ledgers retain affects_stock=false', () => {
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT);

    const brokerLedger = ledgers.find(l => l.name.includes('Zerodha'));
    expect(brokerLedger?.affects_stock).toBe(false);
  });
});

describe('collectRequiredLedgers — TallyProfile path', () => {
  const buyEvent = makeBuyEvent({ security_id: 'NSE:HEG' });
  const sellEvent = makeSellEvent({ security_id: 'NSE:HEG' });
  const events = [buyEvent, sellEvent];

  it('investment ledger has affects_stock=true via TallyProfile', () => {
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT, {
      tallyProfile: INVESTOR_TALLY_DEFAULT,
    });

    // INVESTOR_TALLY_DEFAULT uses template '{symbol}-SH' so ledger name = 'HEG-SH'
    const assetLedger = ledgers.find(l => l.name === 'HEG-SH');
    expect(assetLedger).toBeDefined();
    expect(assetLedger!.affects_stock).toBe(true);
  });

  it('non-asset ledgers (broker, charges) have affects_stock=false via TallyProfile', () => {
    const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT, {
      tallyProfile: INVESTOR_TALLY_DEFAULT,
    });

    const brokerLedger = ledgers.find(l => l.name === INVESTOR_TALLY_DEFAULT.broker.name);
    expect(brokerLedger?.affects_stock).toBe(false);
  });

  it('sell-only event still produces investment ledger with affects_stock=true', () => {
    // tradeSymbols includes both BUY and SELL events — so a sell-only scrip
    // still gets its investment ledger master (needed for the CR line to resolve)
    const sellOnly = [makeSellEvent({ security_id: 'NSE:HEG' })];
    const ledgers = collectRequiredLedgers(sellOnly, INVESTOR_DEFAULT, {
      tallyProfile: INVESTOR_TALLY_DEFAULT,
    });

    const assetLedger = ledgers.find(l => l.name === 'HEG-SH');
    expect(assetLedger).toBeDefined();
    expect(assetLedger!.affects_stock).toBe(true);
  });
});
