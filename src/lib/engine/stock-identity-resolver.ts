import { resolveInvestmentLedger } from '@/lib/engine/ledger-resolver';
import type { LedgerOverride } from '@/lib/db/ledger-repository';
import type { TallyStockItemMapping } from '@/lib/db/stock-item-repository';
import type { TallySecurityMapping } from '@/lib/db/stock-mapping-repository';
import type { TallyProfile } from '@/lib/types/accounting';

export type StockIdentityMatchConfidence =
  | 'explicit'
  | 'tally_alias'
  | 'exact'
  | 'pattern'
  | 'generated'
  | 'unmatched';

export interface ResolvedStockIdentity {
  investmentLedgerName: string;
  investmentLedgerGroup: string;
  stockItemName: string;
  stockItemBaseUnit: string;
  matchConfidence: StockIdentityMatchConfidence;
  stockItemExistsInTally: boolean;
}

export interface StockIdentityResolver {
  resolve(params: {
    symbol: string;
    securityId?: string | null;
    isin?: string | null;
  }): ResolvedStockIdentity;
  hasStockItem(name: string): boolean;
}

interface LedgerCandidate {
  name: string;
  group: string;
  aliases: string[];
}

function normalizeName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function stripKnownTradingSuffix(value: string): string {
  return value
    .replace(/-SH$/i, '')
    .replace(/-(EQ|BE|BZ|SM|ST|A|B|M|T|X)$/i, '');
}

function stripCompanySuffix(value: string): string {
  return value.replace(/(LTD|LIMITED)$/i, '');
}

function symbolVariants(symbol: string, securityId?: string | null, isin?: string | null): Set<string> {
  const upper = symbol.trim().toUpperCase();
  const base = stripKnownTradingSuffix(upper);
  const baseWithoutCompanySuffix = stripCompanySuffix(base);
  const variants = new Set<string>([
    upper,
    `${upper}SH`,
    `SH${upper}`,
    `${upper}EQ`,
    `EQ${upper}`,
    base,
    `${base}SH`,
    `SH${base}`,
    baseWithoutCompanySuffix,
    `${baseWithoutCompanySuffix}SH`,
  ]);

  const securityValue = securityId?.split(':').pop()?.trim().toUpperCase();
  if (securityValue) {
    variants.add(securityValue);
    variants.add(`${securityValue}SH`);
  }

  const isinValue = isin?.trim().toUpperCase();
  if (isinValue) variants.add(isinValue);

  return new Set(Array.from(variants).map(normalizeName));
}

function isinFromSecurityId(securityId?: string | null): string | null {
  const trimmed = securityId?.trim().toUpperCase();
  if (!trimmed?.startsWith('ISIN:')) return null;
  return trimmed.slice('ISIN:'.length) || null;
}

function findVariantMatch<T extends { name: string }>(
  candidates: T[],
  variants: Set<string>,
): T | undefined {
  return candidates.find((candidate) => variants.has(normalizeName(candidate.name)));
}

function findAliasMatch<T extends { name: string; aliases?: string[] }>(
  candidates: T[],
  variants: Set<string>,
): T | undefined {
  return candidates.find((candidate) =>
    (candidate.aliases ?? []).some((alias) => variants.has(normalizeName(alias))),
  );
}

function isLikelyStockLedgerCandidate(candidate: LedgerCandidate, profileInvestmentGroup: string): boolean {
  const group = normalizeName(candidate.group);
  const profileGroup = normalizeName(profileInvestmentGroup);
  const name = normalizeName(candidate.name);

  return (
    group === profileGroup ||
    group.includes('INVESTMENT') ||
    group.includes('STOCKINHAND') ||
    group.includes('STOCKINTRADE') ||
    group.includes('SHARES') ||
    name.endsWith('SH')
  );
}

function normalizedLedgerTokens(candidate: LedgerCandidate): string[] {
  const names = [candidate.name, ...candidate.aliases];
  return names.flatMap((name) => {
    const normalized = normalizeName(name);
    const withoutShareSuffix = normalized.replace(/SH$/, '');
    const withoutCompanySuffix = stripCompanySuffix(withoutShareSuffix);
    return [normalized, withoutShareSuffix, withoutCompanySuffix];
  });
}

function scoreLedgerToken(token: string, variants: Set<string>): number {
  if (token.length < 3) return 0;

  let best = 0;
  for (const variant of variants) {
    if (variant.length < 3) continue;
    const variantWithoutCompanySuffix = stripCompanySuffix(variant);

    if (token === variant) {
      best = Math.max(best, 120);
      continue;
    }

    if (token === variantWithoutCompanySuffix) {
      best = Math.max(best, 100);
      continue;
    }

    const shortest = Math.min(token.length, variantWithoutCompanySuffix.length);
    if (shortest < 4) continue;

    if (token.startsWith(variantWithoutCompanySuffix) || variantWithoutCompanySuffix.startsWith(token)) {
      best = Math.max(best, 80 + shortest);
      continue;
    }

    if (token.includes(variantWithoutCompanySuffix) || variantWithoutCompanySuffix.includes(token)) {
      best = Math.max(best, 65 + shortest);
      continue;
    }

    const commonPrefixLength = countCommonPrefix(token, variantWithoutCompanySuffix);
    if (commonPrefixLength >= 5) {
      best = Math.max(best, 45 + commonPrefixLength);
    }
  }

  return best;
}

function countCommonPrefix(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function findApproxLedgerMatch(
  candidates: LedgerCandidate[],
  variants: Set<string>,
  profileInvestmentGroup: string,
): LedgerCandidate | undefined {
  let best: { candidate: LedgerCandidate; score: number } | undefined;

  for (const candidate of candidates) {
    if (!isLikelyStockLedgerCandidate(candidate, profileInvestmentGroup)) continue;

    const score = Math.max(
      ...normalizedLedgerTokens(candidate).map((token) => scoreLedgerToken(token, variants)),
    );
    if (score < 50) continue;
    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }

  return best?.candidate;
}

function findByName<T extends { name: string }>(
  candidates: T[],
  name: string,
): T | undefined {
  const normalized = normalizeName(name);
  return candidates.find((candidate) => normalizeName(candidate.name) === normalized);
}

function findExplicitMapping(
  mappings: TallySecurityMapping[],
  params: { symbol: string; securityId?: string | null; isin?: string | null },
): TallySecurityMapping | undefined {
  const securityId = params.securityId?.trim().toUpperCase();
  const isin = (params.isin ?? isinFromSecurityId(params.securityId))?.trim().toUpperCase();
  const symbol = params.symbol.trim().toUpperCase();

  return mappings.find((mapping) => {
    const mappingSecurityId = mapping.security_id?.trim().toUpperCase();
    if (securityId && mappingSecurityId && mappingSecurityId === securityId) return true;

    const mappingIsin = mapping.isin?.trim().toUpperCase();
    if (isin && mappingIsin && mappingIsin === isin) return true;

    return mapping.broker_symbol.trim().toUpperCase() === symbol;
  });
}

export function buildStockIdentityResolver(params: {
  tallyProfile: TallyProfile;
  stockItems: TallyStockItemMapping[];
  ledgerOverrides: LedgerOverride[];
  securityMappings?: TallySecurityMapping[];
}): StockIdentityResolver {
  const stockItems = params.stockItems;
  const ledgerCandidates: LedgerCandidate[] = params.ledgerOverrides.map((override) => ({
    name: override.name,
    group: override.parent_group,
    aliases: [],
  }));
  const securityMappings = params.securityMappings ?? [];

  const stockItemNameSet = new Set(
    stockItems.flatMap((item) => [item.name, ...(item.aliases ?? [])].map(normalizeName)),
  );

  return {
    hasStockItem(name) {
      return stockItemNameSet.has(normalizeName(name));
    },

    resolve({ symbol, securityId, isin }) {
      const variants = symbolVariants(symbol, securityId, isin);
      const profileInvestment = resolveInvestmentLedger(params.tallyProfile, symbol);
      const explicitMapping = findExplicitMapping(securityMappings, { symbol, securityId, isin });

      if (explicitMapping) {
        return {
          investmentLedgerName: explicitMapping.tally_ledger_name,
          investmentLedgerGroup: explicitMapping.tally_ledger_group,
          stockItemName: explicitMapping.tally_stock_item_name,
          stockItemBaseUnit: explicitMapping.base_unit || 'NOS',
          matchConfidence: 'explicit',
          stockItemExistsInTally: true,
        };
      }

      const exactLedger =
        findVariantMatch(ledgerCandidates, variants) ??
        findByName(ledgerCandidates, profileInvestment.name) ??
        findApproxLedgerMatch(ledgerCandidates, variants, profileInvestment.group);
      const aliasStockItem = findAliasMatch(stockItems, variants);
      const exactStockItem =
        aliasStockItem ??
        findVariantMatch(stockItems, variants) ??
        findByName(stockItems, exactLedger?.name ?? '') ??
        findByName(stockItems, profileInvestment.name);

      if (aliasStockItem) {
        const matchingLedger = findByName(ledgerCandidates, aliasStockItem.name);
        return {
          investmentLedgerName: matchingLedger?.name ?? profileInvestment.name,
          investmentLedgerGroup: matchingLedger?.group ?? profileInvestment.group,
          stockItemName: aliasStockItem.name,
          stockItemBaseUnit: aliasStockItem.base_unit || 'NOS',
          matchConfidence: 'tally_alias',
          stockItemExistsInTally: true,
        };
      }

      if (exactLedger && exactStockItem) {
        return {
          investmentLedgerName: exactLedger.name,
          investmentLedgerGroup: exactLedger.group,
          stockItemName: exactStockItem.name,
          stockItemBaseUnit: exactStockItem.base_unit || 'NOS',
          matchConfidence: 'exact',
          stockItemExistsInTally: true,
        };
      }

      if (exactLedger) {
        return {
          investmentLedgerName: exactLedger.name,
          investmentLedgerGroup: exactLedger.group,
          stockItemName: exactStockItem?.name ?? exactLedger.name,
          stockItemBaseUnit: exactStockItem?.base_unit || 'NOS',
          matchConfidence: exactStockItem ? 'exact' : 'pattern',
          stockItemExistsInTally: Boolean(exactStockItem),
        };
      }

      if (exactStockItem) {
        return {
          investmentLedgerName: profileInvestment.name,
          investmentLedgerGroup: profileInvestment.group,
          stockItemName: exactStockItem.name,
          stockItemBaseUnit: exactStockItem.base_unit || 'NOS',
          matchConfidence: 'pattern',
          stockItemExistsInTally: true,
        };
      }

      return {
        investmentLedgerName: profileInvestment.name,
        investmentLedgerGroup: profileInvestment.group,
        stockItemName: profileInvestment.name,
        stockItemBaseUnit: 'NOS',
        matchConfidence: 'generated',
        stockItemExistsInTally: false,
      };
    },
  };
}
