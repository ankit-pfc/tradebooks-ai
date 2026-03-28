/**
 * ledger-resolver.ts
 * Resolves TallyProfile naming templates into concrete Tally ledger names.
 *
 * The resolver takes a TallyProfile and a security symbol, substitutes
 * template tokens like {symbol}, and returns the final LedgerDef.
 * It also handles charge consolidation (mapping multiple charge EventTypes
 * to fewer Tally ledgers) and capital gain type routing.
 */

import { EventType } from '../types/events';
import type {
  TallyProfile,
  NamingTemplate,
  GainType,
  LedgerDef,
} from '../types/accounting';

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

/**
 * Substitute {symbol} in a naming template to produce a concrete LedgerDef.
 * If the template contains no {symbol} token, returns the template string as-is.
 */
export function resolveTemplate(
  template: NamingTemplate,
  symbol: string,
): LedgerDef {
  return {
    name: template.template.replace(/\{symbol\}/g, symbol),
    group: template.group,
  };
}

// ---------------------------------------------------------------------------
// Investment ledger resolution
// ---------------------------------------------------------------------------

export function resolveInvestmentLedger(
  profile: TallyProfile,
  symbol: string,
): LedgerDef {
  return resolveTemplate(profile.investment, symbol);
}

// ---------------------------------------------------------------------------
// Capital gain ledger resolution
// ---------------------------------------------------------------------------

const GAIN_TYPE_TEMPLATE_KEY: Record<GainType, keyof Pick<TallyProfile, 'stcg' | 'ltcg' | 'stcl' | 'ltcl'>> = {
  STCG: 'stcg',
  LTCG: 'ltcg',
  STCL: 'stcl',
  LTCL: 'ltcl',
};

/**
 * Resolve the capital gain/loss ledger for a specific security.
 *
 * When `perScripCapitalGains` is true, each security gets its own ledger
 * (e.g. "STCG ON RELIANCE"). When false, the template is used without
 * symbol substitution, producing a single pooled ledger.
 */
export function resolveGainLedger(
  profile: TallyProfile,
  gainType: GainType,
  symbol: string,
): LedgerDef {
  const templateKey = GAIN_TYPE_TEMPLATE_KEY[gainType];
  const template = profile[templateKey];

  if (profile.perScripCapitalGains) {
    return resolveTemplate(template, symbol);
  }

  // Pooled: return template without substitution (template should not contain {symbol})
  return { name: template.template, group: template.group };
}

/**
 * Determine the GainType from holding period and sign of gain.
 *
 * Rules:
 * - holdingPeriodDays === 0 → speculation (returns null, caller uses speculation ledger)
 * - holdingPeriodDays > 365 → LTCG / LTCL
 * - holdingPeriodDays 1..365 → STCG / STCL
 * - isGain determines gain vs loss
 */
export function classifyGain(
  holdingPeriodDays: number | undefined,
  isGain: boolean,
): GainType | 'SPECULATION' {
  if (holdingPeriodDays === 0) {
    return 'SPECULATION';
  }

  const isLongTerm = holdingPeriodDays !== undefined && holdingPeriodDays > 365;

  if (isLongTerm) {
    return isGain ? 'LTCG' : 'LTCL';
  }
  return isGain ? 'STCG' : 'STCL';
}

/**
 * Resolve the P&L ledger for a sell event, handling speculation routing.
 * Returns the appropriate LedgerDef based on holding period and gain/loss sign.
 */
export function resolveCapitalGainLedger(
  profile: TallyProfile,
  symbol: string,
  holdingPeriodDays: number | undefined,
  isGain: boolean,
): LedgerDef {
  const classification = classifyGain(holdingPeriodDays, isGain);

  if (classification === 'SPECULATION') {
    return isGain ? profile.speculationGain : profile.speculationLoss;
  }

  return resolveGainLedger(profile, classification, symbol);
}

// ---------------------------------------------------------------------------
// Dividend ledger resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the dividend income ledger for a specific security.
 * When `perScripDividends` is true, produces per-scrip ledgers (e.g. "DIV RELIANCE").
 * When false, returns the template as a single pooled dividend ledger.
 */
export function resolveDividendLedger(
  profile: TallyProfile,
  symbol: string,
): LedgerDef {
  if (profile.perScripDividends) {
    return resolveTemplate(profile.dividend, symbol);
  }

  return { name: profile.dividend.template, group: profile.dividend.group };
}

// ---------------------------------------------------------------------------
// Charge ledger resolution (consolidation)
// ---------------------------------------------------------------------------

/**
 * Look up which consolidated Tally ledger a charge EventType maps to.
 * Falls back to a generic "Other Charges" ledger if no mapping found.
 */
export function resolveChargeLedger(
  profile: TallyProfile,
  eventType: EventType,
): LedgerDef {
  for (const mapping of profile.chargeConsolidation) {
    if (mapping.eventTypes.includes(eventType)) {
      return { name: mapping.ledgerName, group: mapping.groupName };
    }
  }

  // Fallback — should not happen if profile is well-configured
  return { name: 'Other Charges', group: 'Capital Account' };
}

// ---------------------------------------------------------------------------
// Collect all unique ledgers from a TallyProfile + event data
// ---------------------------------------------------------------------------

export interface CollectedTallyLedgers {
  groups: Array<{ name: string; parent: string }>;
  ledgers: LedgerDef[];
}

/**
 * Given a TallyProfile and sets of symbols that appear in trades/sells/dividends,
 * collect all unique ledger names and groups that need to be created in Tally.
 */
export function collectProfileLedgers(
  profile: TallyProfile,
  tradeSymbols: string[],
  sellSymbolsWithGainType: Array<{ symbol: string; gainType: GainType | 'SPECULATION' }>,
  dividendSymbols: string[],
): CollectedTallyLedgers {
  const seen = new Set<string>();
  const ledgers: LedgerDef[] = [];

  function add(def: LedgerDef): void {
    if (!seen.has(def.name)) {
      seen.add(def.name);
      ledgers.push(def);
    }
  }

  // Fixed ledgers
  add(profile.broker);
  add(profile.bank);

  // Investment ledgers (per-scrip)
  for (const symbol of tradeSymbols) {
    add(resolveInvestmentLedger(profile, symbol));
  }

  // Capital gain ledgers (per-scrip or pooled)
  for (const { symbol, gainType } of sellSymbolsWithGainType) {
    if (gainType === 'SPECULATION') {
      add(profile.speculationGain);
      add(profile.speculationLoss);
    } else {
      add(resolveGainLedger(profile, gainType, symbol));
    }
  }

  // Dividend ledgers
  for (const symbol of dividendSymbols) {
    add(resolveDividendLedger(profile, symbol));
  }

  // Charge ledgers (all consolidated)
  for (const mapping of profile.chargeConsolidation) {
    add({ name: mapping.ledgerName, group: mapping.groupName });
  }

  // TDS ledgers
  add(profile.tdsOnDividend);
  add(profile.tdsOnSecurities);

  // Speculation ledgers (always include if any sells exist)
  if (sellSymbolsWithGainType.length > 0) {
    add(profile.speculationGain);
    add(profile.speculationLoss);
  }

  return {
    groups: [...profile.customGroups],
    ledgers,
  };
}
