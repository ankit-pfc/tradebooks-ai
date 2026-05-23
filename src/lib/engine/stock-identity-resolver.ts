import { resolveInvestmentLedger } from '@/lib/engine/ledger-resolver';
import type { LedgerOverride } from '@/lib/db/ledger-repository';
import type { TallyStockItemMapping } from '@/lib/db/stock-item-repository';
import type { TallyProfile } from '@/lib/types/accounting';

export type StockIdentityMatchConfidence =
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
}

function normalizeName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function symbolVariants(symbol: string, securityId?: string | null, isin?: string | null): Set<string> {
  const upper = symbol.trim().toUpperCase();
  const variants = new Set<string>([
    upper,
    `${upper}SH`,
    `SH${upper}`,
    `${upper}EQ`,
    `EQ${upper}`,
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

function findVariantMatch<T extends { name: string }>(
  candidates: T[],
  variants: Set<string>,
): T | undefined {
  return candidates.find((candidate) => variants.has(normalizeName(candidate.name)));
}

function findByName<T extends { name: string }>(
  candidates: T[],
  name: string,
): T | undefined {
  const normalized = normalizeName(name);
  return candidates.find((candidate) => normalizeName(candidate.name) === normalized);
}

export function buildStockIdentityResolver(params: {
  tallyProfile: TallyProfile;
  stockItems: TallyStockItemMapping[];
  ledgerOverrides: LedgerOverride[];
}): StockIdentityResolver {
  const stockItems = params.stockItems;
  const ledgerCandidates: LedgerCandidate[] = params.ledgerOverrides.map((override) => ({
    name: override.name,
    group: override.parent_group,
  }));

  const stockItemNameSet = new Set(stockItems.map((item) => normalizeName(item.name)));

  return {
    hasStockItem(name) {
      return stockItemNameSet.has(normalizeName(name));
    },

    resolve({ symbol, securityId, isin }) {
      const variants = symbolVariants(symbol, securityId, isin);
      const profileInvestment = resolveInvestmentLedger(params.tallyProfile, symbol);

      const exactLedger =
        findVariantMatch(ledgerCandidates, variants) ??
        findByName(ledgerCandidates, profileInvestment.name);
      const exactStockItem =
        findVariantMatch(stockItems, variants) ??
        findByName(stockItems, exactLedger?.name ?? '') ??
        findByName(stockItems, profileInvestment.name);

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
