/**
 * coa-parser.ts
 * Parses a TallyPrime Chart of Accounts XML export and produces a partial
 * TallyProfile via pattern-matching heuristics.
 *
 * Tally COA XML exports contain <GROUP> and <LEDGER> elements nested inside
 * <TALLYMESSAGE> envelopes, with NAME and PARENT fields describing the
 * group hierarchy.
 */

import { XMLParser } from 'fast-xml-parser';
import { EventType } from '../../types/events';
import type { TallyProfile, NamingTemplate, ChargeConsolidation } from '../../types/accounting';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TallyCOAEntry {
  name: string;
  parent: string;
  type: 'GROUP' | 'LEDGER';
  aliases?: string[];
}

export interface TallyStockItemEntry {
  name: string;
  baseUnit: string;
  aliases?: string[];
  openingQuantity?: string;
  openingValue?: string;
  openingRate?: string;
}

export interface TallyUnitEntry {
  name: string;
}

export interface ParsedCOA {
  groups: TallyCOAEntry[];
  ledgers: TallyCOAEntry[];
  stockItems: TallyStockItemEntry[];
  units: TallyUnitEntry[];
}

export interface COAMatchResult {
  /** Partially populated TallyProfile — only matched fields are set. */
  profile: Partial<TallyProfile>;
  /** Confidence score 0–1 indicating how well the COA matched known patterns. */
  confidence: number;
  /** Ledger names that could not be auto-mapped to any TallyProfile field. */
  unmatchedLedgers: string[];
}

// ---------------------------------------------------------------------------
// XML parsing
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (tagName: string) =>
    tagName === 'TALLYMESSAGE' ||
    tagName === 'GROUP' ||
    tagName === 'LEDGER' ||
    tagName === 'STOCKITEM' ||
    tagName === 'UNIT',
});

/** Normalise the NAME field which can be a string or a {NAME: string} object. */
function extractName(nameField: unknown): string {
  return extractNames(nameField)[0] ?? '';
}

/** Normalise Tally NAME.LIST into a de-duplicated array of names/aliases. */
function extractNames(nameField: unknown): string[] {
  const names: string[] = [];

  function push(value: unknown): void {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (trimmed && !names.includes(trimmed)) names.push(trimmed);
  }

  if (typeof nameField === 'string') {
    push(nameField);
    return names;
  }

  if (nameField && typeof nameField === 'object') {
    const obj = nameField as Record<string, unknown>;
    if ('NAME' in obj) {
      const inner = obj.NAME;
      if (Array.isArray(inner)) {
        inner.forEach(push);
      } else {
        push(inner);
      }
    }
  }
  return names;
}

function aliasesFor(primary: string, names: string[]): string[] | undefined {
  const seen = new Set<string>();
  const aliases = names.filter((name) => {
    const key = name.trim().toUpperCase();
    if (name === primary || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return aliases.length > 0 ? aliases : undefined;
}

function stringField(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.trim() : '';
}

function parseQuantityField(value: unknown): string | undefined {
  const raw = stringField(value);
  if (!raw) return undefined;
  const match = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  return String(Math.abs(Number(match[0])));
}

function parseAmountField(value: unknown): string | undefined {
  const raw = stringField(value);
  if (!raw) return undefined;
  const cleaned = raw.replace(/,/g, '');
  const parenthesized = /\(\s*[-\d.]+\s*\)/.test(cleaned);
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const signed = Number(match[0]) * (parenthesized && !match[0].startsWith('-') ? -1 : 1);
  return Math.abs(signed).toFixed(2);
}

function parseRateField(value: unknown): string | undefined {
  const raw = stringField(value);
  if (!raw) return undefined;
  const match = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  return String(Math.abs(Number(match[0])));
}

/**
 * Parse a TallyPrime COA XML export into structured group and ledger entries.
 * Handles both the ENVELOPE-wrapped and TALLYMESSAGE-only formats.
 */
export function parseTallyCOA(xml: string): ParsedCOA {
  if (!xml || xml.trim().length === 0) {
    return { groups: [], ledgers: [], stockItems: [], units: [] };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to parse COA XML: ${detail}`);
  }

  const groups: TallyCOAEntry[] = [];
  const ledgers: TallyCOAEntry[] = [];
  const stockItems: TallyStockItemEntry[] = [];
  const units: TallyUnitEntry[] = [];

  for (const g of findTallyNodes(parsed, 'GROUP')) {
    const names = extractNames(g['NAME.LIST']);
    const attrName = stringField(g['@_NAME']);
    const name = attrName || names[0] || '';
    const parent = stringField(g.PARENT);
    if (name) {
      const aliasNames = attrName ? [...names, attrName] : names;
      groups.push({ name, parent, type: 'GROUP', aliases: aliasesFor(name, aliasNames) });
    }
  }

  for (const l of findTallyNodes(parsed, 'LEDGER')) {
    const names = extractNames(l['NAME.LIST']);
    const attrName = stringField(l['@_NAME']);
    const name = attrName || names[0] || '';
    const parent = stringField(l.PARENT);
    if (name) {
      const aliasNames = attrName ? [...names, attrName] : names;
      ledgers.push({ name, parent, type: 'LEDGER', aliases: aliasesFor(name, aliasNames) });
    }
  }

  for (const u of findTallyNodes(parsed, 'UNIT')) {
    const name = extractName(u['NAME.LIST']) || stringField(u['@_NAME']) || stringField(u.NAME);
    if (name) {
      units.push({ name });
    }
  }

  for (const s of findTallyNodes(parsed, 'STOCKITEM')) {
    const names = extractNames(s['NAME.LIST']);
    const attrName = stringField(s['@_NAME']);
    const name = attrName || names[0] || '';
    const baseUnit = stringField(s.BASEUNITS) || 'NOS';
    if (name) {
      const aliasNames = attrName ? [...names, attrName] : names;
      const openingQuantity = parseQuantityField(s.OPENINGBALANCE);
      const openingValue = parseAmountField(s.OPENINGVALUE);
      const openingRate =
        parseRateField(s.OPENINGRATE) ??
        (openingQuantity && openingValue && Number(openingQuantity) > 0
          ? String(Number(openingValue) / Number(openingQuantity))
          : undefined);
      stockItems.push({
        name,
        baseUnit,
        aliases: aliasesFor(name, aliasNames),
        openingQuantity,
        openingValue,
        openingRate,
      });
    }
  }

  return {
    groups: dedupeByNameAndParent(groups),
    ledgers: dedupeByNameAndParent(ledgers),
    stockItems: dedupeByName(stockItems),
    units: dedupeByName(units),
  };
}

/** Recursively find Tally master nodes in both import-data and collection exports. */
function findTallyNodes(obj: unknown, tagName: 'GROUP' | 'LEDGER' | 'STOCKITEM' | 'UNIT'): Record<string, unknown>[] {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return obj.flatMap((item) => findTallyNodes(item, tagName));
  }

  const record = obj as Record<string, unknown>;
  const found: Record<string, unknown>[] = [];
  const direct = record[tagName];
  if (direct) {
    const nodes = Array.isArray(direct) ? direct : [direct];
    found.push(
      ...nodes.filter(
        (node): node is Record<string, unknown> => Boolean(node) && typeof node === 'object' && !Array.isArray(node),
      ),
    );
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      found.push(...findTallyNodes(value, tagName));
    }
  }

  return found;
}

function dedupeByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.trim().toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeByNameAndParent<T extends { name: string; parent: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name.trim().toUpperCase()}|${item.parent.trim().toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

/** Keywords used to detect charge ledgers. */
const CHARGE_PATTERNS: Array<{ matches: (name: string) => boolean; eventTypes: EventType[] }> = [
  { matches: (name) => includesAny(name, ['brokerage', 'share brokerage']), eventTypes: [EventType.BROKERAGE] },
  { matches: (name) => includesAny(name, ['stt', 'securities transaction']), eventTypes: [EventType.STT] },
  { matches: (name) => includesAny(name, ['exchange', 'sebi']), eventTypes: [EventType.EXCHANGE_CHARGE, EventType.SEBI_CHARGE] },
  { matches: (name) => includesAny(name, ['gst', 'service tax']), eventTypes: [EventType.GST_ON_CHARGES] },
  { matches: (name) => name.includes('stamp duty'), eventTypes: [EventType.STAMP_DUTY] },
  {
    matches: (name) =>
      includesAny(name, ['dp charge', 'dp charges', 'depository participant charges']),
    eventTypes: [EventType.DP_CHARGE],
  },
];

/** Keywords for identifying broker ledgers. */
const BROKER_KEYWORDS = ['zerodha', 'kite', 'angel', 'groww', 'upstox', 'icici direct', 'hdfc securities'];

/** Groups that indicate Capital Account approach. */
const CAPITAL_ACCOUNT_GROUPS = ['capital account', 'capital a/c'];

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function normalizedLedgerName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Ledgers in this bucket may contain broker words such as "Zerodha" but are
 * accounting-category ledgers, never the trade settlement party ledger.
 */
export function isUnsafeBrokerProfileLedgerName(name: string): boolean {
  const normalized = normalizedLedgerName(name);
  if (!normalized) return false;

  return (
    /\b(amc|demat|dp|depository)\b/.test(normalized) && /\bcharges?\b/.test(normalized) ||
    /\b(charges?|brokerage|stt|gst|sebi|exchange|stamp|tds|dividend)\b/.test(normalized) ||
    /\b(short|long)\s+term\s+capital\s+(gain|loss)\b/.test(normalized) ||
    /\b(stcg|ltcg|stcl|ltcl)\b/.test(normalized) ||
    /\bdiv\b/.test(normalized)
  );
}

function isBrokerCandidate(ledger: TallyCOAEntry, requireBrokerKeyword: boolean): boolean {
  if (isUnsafeBrokerProfileLedgerName(ledger.name)) return false;

  const lower = ledger.name.toLowerCase();
  const hasBrokerKeyword = BROKER_KEYWORDS.some((kw) => lower.includes(kw));
  if (requireBrokerKeyword) return hasBrokerKeyword;

  return hasBrokerKeyword || ledger.parent.toLowerCase() === 'sundry creditors';
}

/**
 * Detect per-scrip naming patterns from a list of ledger names.
 * Returns the template if found (e.g., "{symbol}-SH", "STCG ON {symbol}").
 */
function detectPerScripPattern(
  names: string[],
  knownSymbols: string[],
): string | null {
  if (names.length < 2 || knownSymbols.length === 0) return null;

  for (const name of names) {
    for (const symbol of knownSymbols) {
      if (name.includes(symbol)) {
        // Try to extract template by replacing symbol with {symbol}
        const template = name.replace(symbol, '{symbol}');
        // Verify at least one other name matches the same template
        const matchCount = names.filter((n) =>
          knownSymbols.some((s) => n === template.replace('{symbol}', s)),
        ).length;
        if (matchCount >= 2) return template;
      }
    }
  }
  return null;
}

/**
 * Match a parsed COA to a TallyProfile via heuristic pattern matching.
 *
 * Strategy:
 * 1. Detect whether the COA uses Capital Account or P&L approach
 * 2. Identify broker/bank ledgers by group membership
 * 3. Detect per-scrip templates from investment/gain ledger names
 * 4. Match charge ledgers by keyword
 * 5. Match TDS ledgers by keyword
 */
export function matchCOAToProfile(coa: ParsedCOA): COAMatchResult {
  const profile: Partial<TallyProfile> = {};
  const matched = new Set<string>();
  let matchedFields = 0;
  const totalFields = 10; // broker, bank, investment, stcg, ltcg, stcl, ltcl, dividend, charges, tds

  const lowerGroupNames = coa.groups.map((g) => g.name.toLowerCase());

  // --- Detect Capital Account approach ---
  const isCapitalAccount = lowerGroupNames.some((g) =>
    CAPITAL_ACCOUNT_GROUPS.some((ca) => g.includes(ca)),
  );

  // --- Build group-to-ledgers index ---
  const groupLedgers = new Map<string, string[]>();
  for (const l of coa.ledgers) {
    const parent = l.parent.toLowerCase();
    if (!groupLedgers.has(parent)) groupLedgers.set(parent, []);
    groupLedgers.get(parent)!.push(l.name);
  }

  // --- Find broker ledger ---
  // Prefer explicit broker names first. Only fall back to Sundry Creditors
  // after excluding charge/tax/gain/dividend ledgers such as
  // "AMC CHARGES-ZERODHA", which carry a broker word but are not the
  // settlement ledger used on trade vouchers.
  const brokerLedger =
    coa.ledgers.find((l) => isBrokerCandidate(l, true)) ??
    coa.ledgers.find((l) => isBrokerCandidate(l, false));
  if (brokerLedger) {
    profile.broker = { name: brokerLedger.name, group: brokerLedger.parent };
    matched.add(brokerLedger.name);
    matchedFields++;
  }

  // --- Find bank ledger ---
  for (const l of coa.ledgers) {
    if (l.parent.toLowerCase() === 'bank accounts' ||
        l.parent.toLowerCase() === 'bank account') {
      profile.bank = { name: l.name, group: l.parent };
      matched.add(l.name);
      matchedFields++;
      break;
    }
  }

  // --- Detect investment ledger pattern ---
  const investmentLedgers = coa.ledgers.filter((l) => {
    const parentLower = l.parent.toLowerCase();
    return parentLower.includes('investment') ||
           parentLower.includes('stock-in-hand') ||
           parentLower.includes('stock in hand');
  });

  if (investmentLedgers.length > 0) {
    // Extract symbols from investment ledger names
    const symbols = extractSymbolsFromNames(investmentLedgers.map((l) => l.name));
    const template = detectPerScripPattern(
      investmentLedgers.map((l) => l.name),
      symbols,
    );

    if (template) {
      profile.investment = {
        template,
        group: investmentLedgers[0].parent,
      };
      investmentLedgers.forEach((l) => matched.add(l.name));
      matchedFields++;
    }
  }

  // --- Detect capital gain ledger patterns ---
  const gainKeywords: Record<string, keyof Pick<TallyProfile, 'stcg' | 'ltcg' | 'stcl' | 'ltcl'>> = {
    'stcg': 'stcg',
    'short term capital gain': 'stcg',
    'ltcg': 'ltcg',
    'long term capital gain': 'ltcg',
    'stcl': 'stcl',
    'short term capital loss': 'stcl',
    'ltcl': 'ltcl',
    'long term capital loss': 'ltcl',
  };

  for (const [keyword, field] of Object.entries(gainKeywords)) {
    const matchingLedgers = coa.ledgers.filter((l) =>
      l.name.toLowerCase().includes(keyword),
    );

    if (matchingLedgers.length > 0) {
      const pooledLedger = findPreferredPooledGainLedger(matchingLedgers);
      if (pooledLedger) {
        (profile as Record<string, unknown>)[field] = {
          template: pooledLedger.name,
          group: pooledLedger.parent,
        } satisfies NamingTemplate;
        profile.perScripCapitalGains = false;
        matched.add(pooledLedger.name);
        matchedFields++;
        continue;
      }

      const symbols = extractSymbolsFromNames(matchingLedgers.map((l) => l.name));
      const template = matchingLedgers.length >= 2
        ? detectPerScripPattern(matchingLedgers.map((l) => l.name), symbols)
        : null;

      if (template) {
        (profile as Record<string, unknown>)[field] = {
          template,
          group: matchingLedgers[0].parent,
        } satisfies NamingTemplate;
        profile.perScripCapitalGains = true;
      } else {
        (profile as Record<string, unknown>)[field] = {
          template: matchingLedgers[0].name,
          group: matchingLedgers[0].parent,
        } satisfies NamingTemplate;
      }

      matchingLedgers.forEach((l) => matched.add(l.name));
      matchedFields++;
    }
  }

  // --- Detect dividend ledger pattern ---
  const dividendLedgers = coa.ledgers.filter((l) =>
    l.name.toLowerCase().includes('div') || l.name.toLowerCase().includes('dividend'),
  );
  if (dividendLedgers.length > 0) {
    const symbols = extractSymbolsFromNames(dividendLedgers.map((l) => l.name));
    const template = dividendLedgers.length >= 2
      ? detectPerScripPattern(dividendLedgers.map((l) => l.name), symbols)
      : null;

    if (template) {
      profile.dividend = { template, group: dividendLedgers[0].parent };
      profile.perScripDividends = true;
    } else {
      profile.dividend = { template: dividendLedgers[0].name, group: dividendLedgers[0].parent };
    }
    dividendLedgers.forEach((l) => matched.add(l.name));
    matchedFields++;
  }

  // --- Match charge ledgers ---
  const chargeConsolidation: ChargeConsolidation[] = [];
  for (const pattern of CHARGE_PATTERNS) {
    for (const l of coa.ledgers) {
      const lower = l.name.toLowerCase();
      if (pattern.matches(lower)) {
        chargeConsolidation.push({
          eventTypes: pattern.eventTypes,
          ledgerName: l.name,
          groupName: l.parent,
        });
        matched.add(l.name);
        break;
      }
    }
  }
  if (chargeConsolidation.length > 0) {
    profile.chargeConsolidation = chargeConsolidation;
    matchedFields++;
  }

  // --- Match TDS ledgers ---
  const tdsLedgers = coa.ledgers.filter((l) =>
    l.name.toLowerCase().includes('tds'),
  );
  for (const l of tdsLedgers) {
    const lower = l.name.toLowerCase();
    if (lower.includes('dividend')) {
      profile.tdsOnDividend = { name: l.name, group: l.parent };
      matched.add(l.name);
    } else if (lower.includes('securities') || lower.includes('share')) {
      profile.tdsOnSecurities = { name: l.name, group: l.parent };
      matched.add(l.name);
    }
  }
  if (profile.tdsOnDividend || profile.tdsOnSecurities) {
    matchedFields++;
  }

  // --- Custom groups ---
  if (isCapitalAccount) {
    profile.customGroups = coa.groups
      .filter((g) => {
        const parentLower = g.parent.toLowerCase();
        return CAPITAL_ACCOUNT_GROUPS.some((ca) => parentLower.includes(ca));
      })
      .map((g) => ({ name: g.name, parent: g.parent }));
  }

  // --- Confidence ---
  const confidence = Math.min(1, matchedFields / totalFields);

  // --- Unmatched ledgers ---
  const unmatchedLedgers = coa.ledgers
    .filter((l) => !matched.has(l.name))
    .map((l) => l.name);

  return { profile, confidence, unmatchedLedgers };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function findPreferredPooledGainLedger(ledgers: TallyCOAEntry[]): TallyCOAEntry | undefined {
  const scored = ledgers
    .map((ledger) => ({ ledger, score: pooledGainLedgerScore(ledger.name) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.ledger;
}

function pooledGainLedgerScore(name: string): number {
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  let score = 0;

  if (normalized.includes('sale of shares')) score += 4;
  if (normalized.includes('zerodha') || normalized.includes('kite')) score += 4;
  if (normalized.includes('shares')) score += 1;

  // Avoid old per-scrip ledgers such as "STCG ON RELIANCE" when a pooled
  // broker/FY ledger exists in the same Tally master.
  if (/^(stcg|ltcg|stcl|ltcl)\s+on\s+[a-z0-9 .&]+$/i.test(name) && !normalized.includes('sale of shares')) {
    score -= 4;
  }

  return score;
}

/**
 * Try to extract stock symbols from a list of ledger names.
 * Common patterns: "RELIANCE-SH", "STCG ON RELIANCE", "DIV RELIANCE"
 * Known Indian blue-chip symbols used as anchors for detection.
 */
const COMMON_SYMBOLS = [
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN',
  'BHARTIARTL', 'ITC', 'LT', 'HINDUNILVR', 'BAJFINANCE', 'WIPRO',
  'MARUTI', 'TATAMOTORS', 'TATASTEEL', 'SUNPHARMA', 'AXISBANK',
  'KOTAKBANK', 'NTPC', 'POWERGRID', 'ONGC', 'COALINDIA', 'ADANIENT',
  'ADANIPORTS', 'JSWSTEEL', 'TITAN', 'ASIANPAINT', 'ULTRACEMCO',
];

function extractSymbolsFromNames(names: string[]): string[] {
  const found = new Set<string>();

  for (const name of names) {
    const upper = name.toUpperCase();
    for (const symbol of COMMON_SYMBOLS) {
      if (upper.includes(symbol)) {
        found.add(symbol);
      }
    }
  }

  // Also try to extract from patterns like "XXXXX-SH" or "STCG ON XXXXX"
  for (const name of names) {
    const dashMatch = name.match(/^([A-Z][A-Z0-9]+)-/);
    if (dashMatch) found.add(dashMatch[1]);

    const onMatch = name.match(/\bON\s+([A-Z][A-Z0-9]+)/);
    if (onMatch) found.add(onMatch[1]);

    const divMatch = name.match(/^DIV\s+([A-Z][A-Z0-9]+)/);
    if (divMatch) found.add(divMatch[1]);
  }

  return Array.from(found);
}
