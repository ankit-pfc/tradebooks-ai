/**
 * ledger-masters.ts
 * Derives the complete set of Tally ledger masters required for a given export.
 *
 * TallyPrime will reject a voucher import if a referenced ledger does not
 * already exist in the company.  This module inspects the canonical events and
 * the accounting profile to produce a de-duplicated list of LedgerMasterInput
 * records that can be fed directly to generateMastersXml().
 *
 * Ledger-group mapping rationale
 * ─────────────────────────────
 * Broker / settlement ledger  → "Sundry Debtors"
 * Bank clearing ledger        → "Bank Accounts"
 * Transaction charges         → "Indirect Expenses"  (STT, stamp duty, DP charges, SEBI, GST)
 * Brokerage (direct cost)     → "Direct Expenses"    (directly attributable to trades)
 * Securities — investor mode  → "Investments"        (held as capital assets)
 * Securities — trader mode    → "Stock-in-Hand"      (treated as trading inventory)
 * Realised P&L — investor     → "Indirect Incomes"   (capital gains classified as other income)
 * Realised P&L — trader       → "Direct Incomes"     (business income from trading)
 * Dividend income             → "Indirect Incomes"
 */

import type { CanonicalEvent } from '../types/events';
import { EventType } from '../types/events';
import type { AccountingProfile } from '../types/accounting';
import { AccountingMode, LedgerStrategy } from '../types/accounting';
import type { LedgerMasterInput } from './tally-xml';

// ---------------------------------------------------------------------------
// Fixed ledger catalogue
// ---------------------------------------------------------------------------

/** Broker settlement account — always required. */
const BROKER_LEDGER: LedgerMasterInput = {
  name: 'Zerodha Broking',
  parent_group: 'Sundry Debtors',
  affects_stock: false,
};

/** Bank placeholder — always required as the contra for fund movements. */
const BANK_LEDGER: LedgerMasterInput = {
  name: 'Bank Account',
  parent_group: 'Bank Accounts',
  affects_stock: false,
};

/**
 * Standard charge ledgers that appear on virtually every Zerodha contract
 * note.  These are always included so the XML can never fail on a missing
 * ledger when a charge line is present.
 */
const CHARGE_LEDGERS: LedgerMasterInput[] = [
  {
    name: 'Brokerage',
    parent_group: 'Direct Expenses',
    affects_stock: false,
  },
  {
    name: 'Securities Transaction Tax (STT)',
    parent_group: 'Indirect Expenses',
    affects_stock: false,
  },
  {
    name: 'Exchange Transaction Charges',
    parent_group: 'Indirect Expenses',
    affects_stock: false,
  },
  {
    name: 'SEBI Turnover Charges',
    parent_group: 'Indirect Expenses',
    affects_stock: false,
  },
  {
    name: 'GST on Brokerage & Charges',
    parent_group: 'Indirect Expenses',
    affects_stock: false,
  },
  {
    name: 'Stamp Duty',
    parent_group: 'Indirect Expenses',
    affects_stock: false,
  },
  {
    name: 'Depository (DP) Charges',
    parent_group: 'Indirect Expenses',
    affects_stock: false,
  },
];

// ---------------------------------------------------------------------------
// EventType → charge ledger name mapping
// ---------------------------------------------------------------------------

/**
 * Maps charge EventTypes to their canonical Tally ledger name.
 * Used when scanning events to confirm which charge ledgers are actually needed
 * (though we include all charge ledgers unconditionally for safety).
 */
const CHARGE_EVENT_TO_LEDGER: Partial<Record<EventType, string>> = {
  [EventType.BROKERAGE]: 'Brokerage',
  [EventType.STT]: 'Securities Transaction Tax (STT)',
  [EventType.EXCHANGE_CHARGE]: 'Exchange Transaction Charges',
  [EventType.SEBI_CHARGE]: 'SEBI Turnover Charges',
  [EventType.GST_ON_CHARGES]: 'GST on Brokerage & Charges',
  [EventType.STAMP_DUTY]: 'Stamp Duty',
  [EventType.DP_CHARGE]: 'Depository (DP) Charges',
};

// ---------------------------------------------------------------------------
// Security ledger name builders
// ---------------------------------------------------------------------------

/**
 * Returns the Tally ledger name for a security in INVESTOR mode.
 * Format: "Investment in Equity Shares - {SYMBOL}"
 */
function investmentLedgerName(symbol: string): string {
  return `Investment in Equity Shares - ${symbol}`;
}

/**
 * Returns the Tally ledger name for a security in TRADER mode.
 * Format: "Shares-in-Trade - {SYMBOL}"
 */
function tradingStockLedgerName(symbol: string): string {
  return `Shares-in-Trade - ${symbol}`;
}

// ---------------------------------------------------------------------------
// Pooled (non-script-level) fallback ledgers
// ---------------------------------------------------------------------------

const POOLED_INVESTMENT_LEDGER: LedgerMasterInput = {
  name: 'Investment in Equity Shares',
  parent_group: 'Investments',
  affects_stock: false,
};

const POOLED_TRADING_STOCK_LEDGER: LedgerMasterInput = {
  name: 'Shares-in-Trade',
  parent_group: 'Stock-in-Hand',
  affects_stock: true,
};

// ---------------------------------------------------------------------------
// P&L ledgers
// ---------------------------------------------------------------------------

/**
 * Returns P&L ledgers appropriate for the accounting mode.
 *
 * Investor: short-term and long-term capital gains are "Indirect Incomes"
 *   (outside the scope of business income on the P&L).
 * Trader: realised trading profit/loss is "Direct Incomes" / "Direct Expenses"
 *   (forms part of business income).
 */
function getPnlLedgers(mode: AccountingMode): LedgerMasterInput[] {
  if (mode === AccountingMode.INVESTOR) {
    return [
      {
        name: 'Short Term Capital Gains on Shares',
        parent_group: 'Indirect Incomes',
        affects_stock: false,
      },
      {
        name: 'Long Term Capital Gains on Shares',
        parent_group: 'Indirect Incomes',
        affects_stock: false,
      },
      {
        name: 'Dividend Income',
        parent_group: 'Indirect Incomes',
        affects_stock: false,
      },
    ];
  }

  // TRADER mode
  return [
    {
      name: 'Profit on Sale of Shares-in-Trade',
      parent_group: 'Direct Incomes',
      affects_stock: false,
    },
    {
      name: 'Loss on Sale of Shares-in-Trade',
      parent_group: 'Direct Expenses',
      affects_stock: false,
    },
    {
      name: 'Dividend Income',
      parent_group: 'Indirect Incomes',
      affects_stock: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// Security symbol extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the set of unique security symbols touched by trade events.
 *
 * The CanonicalEvent type stores security_id (a FK), not the symbol directly.
 * In practice the calling context either:
 *   (a) Joins events with SecurityMaster records before calling this function,
 *       storing the symbol in a synthetic field, OR
 *   (b) Uses the security_id itself as a stand-in symbol (UUID, not ideal).
 *
 * To bridge this gap without coupling the exporter to the database layer, we
 * accept an optional symbol resolver map.  When absent, we fall back to
 * security_id so the function remains independently usable.
 */
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
// Main export
// ---------------------------------------------------------------------------

export interface CollectLedgersOptions {
  /**
   * Optional map of security_id → trading symbol for generating human-readable
   * per-script ledger names.  When omitted, security_id is used as the symbol.
   */
  symbolMap?: Map<string, string>;
}

/**
 * Derives all Tally ledger masters required to import the supplied canonical
 * events under the given accounting profile.
 *
 * The returned array is de-duplicated and deterministically ordered:
 *   1. Broker settlement ledger
 *   2. Bank account ledger
 *   3. Charge ledgers (always included)
 *   4. Security ledgers (per-script or pooled, depending on LedgerStrategy)
 *   5. P&L ledgers (investor or trader, depending on AccountingMode)
 *
 * @param events   Canonical events from the parsed broker tradebook.
 * @param profile  Accounting profile controlling mode and ledger strategy.
 * @param options  Optional resolver map for security symbols.
 * @returns        De-duplicated list of ledger master descriptors.
 */
export function collectRequiredLedgers(
  events: CanonicalEvent[],
  profile: AccountingProfile,
  options: CollectLedgersOptions = {},
): LedgerMasterInput[] {
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

  // 2. Charge ledgers — included unconditionally so the XML never fails due to
  //    a missing ledger when an unexpected charge type appears in the data.
  for (const chargeLedger of CHARGE_LEDGERS) {
    add(chargeLedger);
  }

  // 3. Security (investment / stock-in-trade) ledgers.
  if (profile.ledger_strategy === LedgerStrategy.SCRIPT_LEVEL) {
    const symbols = extractUniqueSymbols(events, options.symbolMap);

    for (const symbol of symbols) {
      if (profile.mode === AccountingMode.INVESTOR) {
        add({
          name: investmentLedgerName(symbol),
          parent_group: 'Investments',
          affects_stock: false,
        });
      } else {
        // TRADER
        add({
          name: tradingStockLedgerName(symbol),
          parent_group: 'Stock-in-Hand',
          affects_stock: true,
        });
      }
    }
  } else {
    // POOLED — single ledger for all securities under this asset class.
    if (profile.mode === AccountingMode.INVESTOR) {
      add(POOLED_INVESTMENT_LEDGER);
    } else {
      add(POOLED_TRADING_STOCK_LEDGER);
    }
  }

  // 4. P&L ledgers (mode-dependent).
  for (const pnlLedger of getPnlLedgers(profile.mode)) {
    add(pnlLedger);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Re-export LedgerMasterInput so callers only need to import from this module.
// ---------------------------------------------------------------------------
export type { LedgerMasterInput };
