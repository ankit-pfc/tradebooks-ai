/**
 * ledger-masters.ts
 * Derives the complete set of Tally ledger masters required for a given export.
 *
 * TallyPrime will reject a voucher import if a referenced ledger does not
 * already exist in the company.  This module inspects the canonical events and
 * the accounting profile to produce a de-duplicated list of LedgerMasterInput
 * records that can be fed directly to generateMastersXml().
 *
 * All ledger names are imported from `constants/ledger-names.ts` — the single
 * source of truth shared with voucher-builder.ts.
 */

import type { CanonicalEvent } from '../types/events';
import { EventType } from '../types/events';
import type { AccountingProfile, TallyProfile } from '../types/accounting';
import { AccountingMode, LedgerStrategy } from '../types/accounting';
import type { LedgerMasterInput } from './tally-xml';
import * as L from '../constants/ledger-names';
import { collectProfileLedgers, resolveInvestmentLedger } from '../engine/ledger-resolver';
import { TradeClassification } from '../engine/trade-classifier';

// ---------------------------------------------------------------------------
// Fixed ledger catalogue
// ---------------------------------------------------------------------------

/** Broker settlement account — always required. */
const BROKER_LEDGER: LedgerMasterInput = {
  name: L.BROKER.name,
  parent_group: L.BROKER.group,
  affects_stock: false,
};

/** Bank placeholder — always required as the contra for fund movements. */
const BANK_LEDGER: LedgerMasterInput = {
  name: L.BANK.name,
  parent_group: L.BANK.group,
  affects_stock: false,
};

/**
 * Standard charge ledgers derived from the unified constants.
 * Always included so the XML can never fail on a missing ledger.
 */
const CHARGE_LEDGERS: LedgerMasterInput[] = L.ALL_CHARGE_LEDGERS.map((def) => ({
  name: def.name,
  parent_group: def.group,
  affects_stock: false,
}));

// ---------------------------------------------------------------------------
// Security symbol extraction helpers
// ---------------------------------------------------------------------------

function extractUniqueSymbols(
  events: CanonicalEvent[],
  symbolMap?: Map<string, string>,
): string[] {
  const symbols = new Set<string>();

  for (const event of events) {
    if (
      (event.event_type === EventType.BUY_TRADE ||
        event.event_type === EventType.SELL_TRADE) &&
      event.security_id !== null
    ) {
      const resolved = symbolMap?.get(event.security_id) ?? event.security_id;
      symbols.add(resolved);
    }
  }

  return Array.from(symbols).sort();
}

// ---------------------------------------------------------------------------
// P&L ledgers
// ---------------------------------------------------------------------------

function getPnlLedgers(mode: AccountingMode): LedgerMasterInput[] {
  if (mode === AccountingMode.INVESTOR) {
    return [
      { name: L.STCG_PROFIT.name, parent_group: L.STCG_PROFIT.group, affects_stock: false },
      { name: L.STCG_LOSS.name, parent_group: L.STCG_LOSS.group, affects_stock: false },
      { name: L.LTCG_PROFIT.name, parent_group: L.LTCG_PROFIT.group, affects_stock: false },
      { name: L.LTCG_LOSS.name, parent_group: L.LTCG_LOSS.group, affects_stock: false },
      { name: L.SPECULATIVE_PROFIT.name, parent_group: L.SPECULATIVE_PROFIT.group, affects_stock: false },
      { name: L.SPECULATIVE_LOSS.name, parent_group: L.SPECULATIVE_LOSS.group, affects_stock: false },
      { name: L.DIVIDEND_INCOME.name, parent_group: L.DIVIDEND_INCOME.group, affects_stock: false },
    ];
  }

  // TRADER mode
  return [
    { name: L.TRADING_SALES.name, parent_group: L.TRADING_SALES.group, affects_stock: false },
    { name: L.COST_OF_SHARES_SOLD.name, parent_group: L.COST_OF_SHARES_SOLD.group, affects_stock: false },
    { name: L.DIVIDEND_INCOME.name, parent_group: L.DIVIDEND_INCOME.group, affects_stock: false },
  ];
}

// ---------------------------------------------------------------------------
// TallyProfile-based ledger collection
// ---------------------------------------------------------------------------

/** Extract the security symbol from a composite security_id ("EXCHANGE:SYMBOL"). */
function extractSymbol(securityId: string): string {
  const parts = securityId.split(':');
  return parts.length > 1 ? parts[1] : securityId;
}

function collectLedgersFromProfile(
  events: CanonicalEvent[],
  tallyProfile: TallyProfile,
  symbolMap?: Map<string, string>,
): LedgerMasterInput[] {
  const tradeSymbols = new Set<string>();
  const sellSymbols = new Set<string>();
  const dividendSymbols = new Set<string>();

  for (const event of events) {
    if (!event.security_id) continue;
    // Prefer security_symbol (always the human-readable broker symbol like "RELIANCE")
    // over extracting from security_id (which may be an ISIN code like "ISIN:INE002A01018").
    // This mirrors the voucher-builder's symbolFromEvent() logic so that ledger masters
    // and voucher lines reference the same ledger names.
    const symbol = event.security_symbol
      ?? extractSymbol(symbolMap?.get(event.security_id) ?? event.security_id);

    if (event.event_type === EventType.BUY_TRADE || event.event_type === EventType.SELL_TRADE) {
      tradeSymbols.add(symbol);
    }
    if (event.event_type === EventType.SELL_TRADE) {
      sellSymbols.add(symbol);
    }
    if (event.event_type === EventType.DIVIDEND) {
      dividendSymbols.add(symbol);
    }
  }

  // For ledger master collection, generate all gain type variants per sold symbol
  // since we don't know holding period at this stage. Unused masters are harmless.
  const sellEntries: Array<{ symbol: string; gainType: 'STCG' | 'LTCG' | 'STCL' | 'LTCL' | 'SPECULATION' }> = [];
  for (const symbol of sellSymbols) {
    sellEntries.push({ symbol, gainType: 'STCG' });
    sellEntries.push({ symbol, gainType: 'LTCG' });
    sellEntries.push({ symbol, gainType: 'STCL' });
    sellEntries.push({ symbol, gainType: 'LTCL' });
    sellEntries.push({ symbol, gainType: 'SPECULATION' });
  }

  const collected = collectProfileLedgers(
    tallyProfile,
    Array.from(tradeSymbols),
    sellEntries,
    Array.from(dividendSymbols),
  );

  // Investment/asset ledgers must have affects_stock: true so Tally updates
  // its stock register on PURCHASE vouchers — without this, SALES are silently
  // skipped because Tally sees zero stock for every scrip.
  const investmentLedgerNames = new Set(
    Array.from(tradeSymbols).map((sym) => resolveInvestmentLedger(tallyProfile, sym).name),
  );

  const hasBusinessClassifiedTrades = events.some(
    (event) =>
      event.trade_classification === TradeClassification.SPECULATIVE_BUSINESS ||
      event.trade_classification === TradeClassification.NON_SPECULATIVE_BUSINESS,
  );

  const hasInvestmentClassifiedTrades = events.some(
    (event) => event.trade_classification === TradeClassification.INVESTMENT,
  );

  const supplementalLedgers: LedgerMasterInput[] = [];

  if (hasBusinessClassifiedTrades) {
    supplementalLedgers.push(
      { name: L.TRADING_SALES.name, parent_group: L.TRADING_SALES.group, affects_stock: false },
      {
        name: L.COST_OF_SHARES_SOLD.name,
        parent_group: L.COST_OF_SHARES_SOLD.group,
        affects_stock: false,
      },
    );
  }

  if (hasInvestmentClassifiedTrades) {
    supplementalLedgers.push(
      { name: L.STCG_PROFIT.name, parent_group: L.STCG_PROFIT.group, affects_stock: false },
      { name: L.STCG_LOSS.name, parent_group: L.STCG_LOSS.group, affects_stock: false },
      { name: L.LTCG_PROFIT.name, parent_group: L.LTCG_PROFIT.group, affects_stock: false },
      { name: L.LTCG_LOSS.name, parent_group: L.LTCG_LOSS.group, affects_stock: false },
    );
  }

  return [...collected.ledgers.map((def) => ({
    name: def.name,
    parent_group: def.group,
    affects_stock: investmentLedgerNames.has(def.name),
  })), ...supplementalLedgers].filter(
    (ledger, index, all) => all.findIndex((candidate) => candidate.name === ledger.name) === index,
  );
}

function getRequiredModes(events: CanonicalEvent[], fallbackMode: AccountingMode): Set<AccountingMode> {
  const modes = new Set<AccountingMode>();

  for (const event of events) {
    switch (event.trade_classification) {
      case TradeClassification.INVESTMENT:
        modes.add(AccountingMode.INVESTOR);
        break;
      case TradeClassification.SPECULATIVE_BUSINESS:
      case TradeClassification.NON_SPECULATIVE_BUSINESS:
        modes.add(AccountingMode.TRADER);
        break;
      default:
        break;
    }
  }

  if (modes.size === 0) {
    modes.add(fallbackMode);
  }

  return modes;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface CollectLedgersOptions {
  symbolMap?: Map<string, string>;
  tallyProfile?: TallyProfile;
}

export function collectRequiredLedgers(
  events: CanonicalEvent[],
  profile: AccountingProfile,
  options: CollectLedgersOptions = {},
): LedgerMasterInput[] {
  // When a TallyProfile is provided, delegate to the resolver's collector
  if (options.tallyProfile) {
    return collectLedgersFromProfile(events, options.tallyProfile, options.symbolMap);
  }

  const seen = new Set<string>();
  const result: LedgerMasterInput[] = [];

  function add(ledger: LedgerMasterInput): void {
    if (!seen.has(ledger.name)) {
      seen.add(ledger.name);
      result.push(ledger);
    }
  }

  // 1. Always-required fixed ledgers.
  add(BROKER_LEDGER);
  add(BANK_LEDGER);

  // 2. Charge ledgers — included unconditionally.
  for (const chargeLedger of CHARGE_LEDGERS) {
    add(chargeLedger);
  }

  // 3. Misc charge ledgers.
  add({ name: L.AMC_CHARGES.name, parent_group: L.AMC_CHARGES.group, affects_stock: false });
  add({ name: L.MISC_CHARGES.name, parent_group: L.MISC_CHARGES.group, affects_stock: false });

  const requiredModes = getRequiredModes(events, profile.mode);

  // 4. Security (investment / stock-in-trade) ledgers.
  if (profile.ledger_strategy === LedgerStrategy.SCRIPT_LEVEL) {
    const symbols = extractUniqueSymbols(events, options.symbolMap);

    for (const symbol of symbols) {
      if (requiredModes.has(AccountingMode.INVESTOR)) {
        const def = L.investmentLedger(symbol);
        add({ name: def.name, parent_group: def.group, affects_stock: true });
      }

      if (requiredModes.has(AccountingMode.TRADER)) {
        const def = L.stockInTradeLedger(symbol);
        add({ name: def.name, parent_group: def.group, affects_stock: true });
      }
    }
  } else {
    // POOLED — single ledger for all securities.
    if (requiredModes.has(AccountingMode.INVESTOR)) {
      add({ name: L.POOLED_INVESTMENT.name, parent_group: L.POOLED_INVESTMENT.group, affects_stock: true });
    }

    if (requiredModes.has(AccountingMode.TRADER)) {
      add({ name: L.POOLED_STOCK_IN_TRADE.name, parent_group: L.POOLED_STOCK_IN_TRADE.group, affects_stock: true });
    }
  }

  // 5. P&L ledgers (mode-dependent).
  for (const mode of requiredModes) {
    for (const pnlLedger of getPnlLedgers(mode)) {
      add(pnlLedger);
    }
  }

  return result;
}

export type { LedgerMasterInput };
