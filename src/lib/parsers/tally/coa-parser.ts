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
}

export interface ParsedCOA {
  groups: TallyCOAEntry[];
  ledgers: TallyCOAEntry[];
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
    tagName === 'LEDGER',
});

/** Normalise the NAME field which can be a string or a {NAME: string} object. */
function extractName(nameField: unknown): string {
  if (typeof nameField === 'string') return nameField;
  if (nameField && typeof nameField === 'object') {
    const obj = nameField as Record<string, unknown>;
    if ('NAME' in obj) {
      const inner = obj.NAME;
      if (typeof inner === 'string') return inner;
      if (Array.isArray(inner)) return String(inner[0]);
    }
  }
  return '';
}

/**
 * Parse a TallyPrime COA XML export into structured group and ledger entries.
 * Handles both the ENVELOPE-wrapped and TALLYMESSAGE-only formats.
 */
export function parseTallyCOA(xml: string): ParsedCOA {
  if (!xml || xml.trim().length === 0) {
    return { groups: [], ledgers: [] };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new Error('Failed to parse COA XML: invalid XML format');
  }

  const groups: TallyCOAEntry[] = [];
  const ledgers: TallyCOAEntry[] = [];

  // Navigate to TALLYMESSAGE array — may be at different nesting levels
  const messages = findTallyMessages(parsed);

  for (const msg of messages) {
    // Each TALLYMESSAGE may contain GROUP and/or LEDGER elements
    if (msg.GROUP) {
      const groupList = Array.isArray(msg.GROUP) ? msg.GROUP : [msg.GROUP];
      for (const g of groupList) {
        const name = extractName(g['NAME.LIST']) || g['@_NAME'] || '';
        const parent = g.PARENT || '';
        if (name) {
          groups.push({ name, parent, type: 'GROUP' });
        }
      }
    }

    if (msg.LEDGER) {
      const ledgerList = Array.isArray(msg.LEDGER) ? msg.LEDGER : [msg.LEDGER];
      for (const l of ledgerList) {
        const name = extractName(l['NAME.LIST']) || l['@_NAME'] || '';
        const parent = l.PARENT || '';
        if (name) {
          ledgers.push({ name, parent, type: 'LEDGER' });
        }
      }
    }
  }

  return { groups, ledgers };
}

/** Recursively find TALLYMESSAGE arrays in the parsed XML. */
function findTallyMessages(obj: Record<string, unknown>): Record<string, unknown>[] {
  if ('TALLYMESSAGE' in obj) {
    const tm = obj.TALLYMESSAGE;
    return Array.isArray(tm) ? tm : [tm as Record<string, unknown>];
  }

  // Try nested paths: ENVELOPE > BODY > IMPORTDATA > REQUESTDATA > TALLYMESSAGE
  for (const key of ['ENVELOPE', 'BODY', 'IMPORTDATA', 'REQUESTDATA', 'DATA']) {
    if (key in obj && obj[key] && typeof obj[key] === 'object') {
      return findTallyMessages(obj[key] as Record<string, unknown>);
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

/** Keywords used to detect charge ledgers. */
const CHARGE_PATTERNS: Array<{ keywords: string[]; eventTypes: EventType[] }> = [
  { keywords: ['brokerage', 'share brokerage'], eventTypes: [EventType.BROKERAGE] },
  { keywords: ['stt', 'securities transaction'], eventTypes: [EventType.STT] },
  { keywords: ['exchange', 'sebi'], eventTypes: [EventType.EXCHANGE_CHARGE, EventType.SEBI_CHARGE] },
  { keywords: ['gst', 'service tax'], eventTypes: [EventType.GST_ON_CHARGES] },
  { keywords: ['stamp duty'], eventTypes: [EventType.STAMP_DUTY] },
  { keywords: ['dp charge', 'dp charges', 'demat', 'depository'], eventTypes: [EventType.DP_CHARGE] },
];

/** Keywords for identifying broker ledgers. */
const BROKER_KEYWORDS = ['zerodha', 'kite', 'angel', 'groww', 'upstox', 'icici direct', 'hdfc securities'];

/** Groups that indicate Capital Account approach. */
const CAPITAL_ACCOUNT_GROUPS = ['capital account', 'capital a/c'];

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
  for (const l of coa.ledgers) {
    const lower = l.name.toLowerCase();
    if (BROKER_KEYWORDS.some((kw) => lower.includes(kw)) ||
        l.parent.toLowerCase() === 'sundry creditors') {
      profile.broker = { name: l.name, group: l.parent };
      matched.add(l.name);
      matchedFields++;
      break;
    }
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
      if (pattern.keywords.some((kw) => lower.includes(kw))) {
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
