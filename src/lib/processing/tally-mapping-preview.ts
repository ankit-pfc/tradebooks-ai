import { detectFileType } from '@/lib/parsers/zerodha/detect';
import { parseTradebook } from '@/lib/parsers/zerodha/tradebook';
import { parseTaxPnl } from '@/lib/parsers/zerodha/taxpnl';
import { buildUnifiedSecurityId } from '@/lib/engine/canonical-events';
import {
  getDefaultTallyProfile,
  mergeOverridesIntoProfile,
} from '@/lib/engine/accounting-policy';
import { buildStockIdentityResolver } from '@/lib/engine/stock-identity-resolver';
import {
  isLikelyStockLedgerCandidate,
  isValidStockSecurityMapping,
} from '@/lib/engine/stock-ledger-classification';
import type { LedgerOverride } from '@/lib/db/ledger-repository';
import type { TallyStockItemMapping } from '@/lib/db/stock-item-repository';
import type { TallySecurityMapping } from '@/lib/db/stock-mapping-repository';
import type { UserSettings } from '@/lib/types/domain';
import { AccountingMode } from '@/lib/types/accounting';

export type TallyMappingPreviewConfidence =
  | 'saved'
  | 'exact'
  | 'alias'
  | 'pattern'
  | 'generated'
  | 'unmatched';

export type TallyMappingPreviewStatus = 'saved' | 'suggested' | 'needs_review' | 'missing';

export interface TallyMappingCandidate {
  name: string;
  group: string;
}

export interface TallyMappingPreviewRow {
  broker_symbol: string;
  security_id: string | null;
  isin: string | null;
  suggested_ledger_name: string | null;
  suggested_ledger_group: string | null;
  suggested_stock_item_name: string | null;
  base_unit: string;
  confidence: TallyMappingPreviewConfidence;
  status: TallyMappingPreviewStatus;
  candidates: TallyMappingCandidate[];
}

export interface TallyMappingPreviewResponse {
  rows: TallyMappingPreviewRow[];
  summary: {
    total: number;
    saved: number;
    suggested: number;
    needsReview: number;
    missing: number;
  };
}

export interface TallyMappingPreviewFile {
  fileName: string;
  buffer: Buffer;
  detectedType?: string | null;
}

interface SecurityRef {
  broker_symbol: string;
  security_id: string | null;
  isin: string | null;
}

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

function cleanIsin(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toUpperCase();
  if (!trimmed || trimmed === 'NA' || trimmed === 'N/A' || trimmed === '-') return null;
  return trimmed;
}

function securityKey(ref: SecurityRef): string {
  const securityId = ref.security_id?.trim().toUpperCase();
  if (securityId) return `SECURITY:${securityId}`;

  const isin = cleanIsin(ref.isin);
  if (isin) return `ISIN:${isin}`;

  return `SYMBOL:${normalize(ref.broker_symbol)}`;
}

function findSavedMapping(
  mappings: TallySecurityMapping[],
  ref: SecurityRef,
): TallySecurityMapping | undefined {
  const symbol = normalize(ref.broker_symbol);
  const securityId = ref.security_id?.trim().toUpperCase();
  const isin = cleanIsin(ref.isin);

  const exactSecurity = mappings.find(
    (mapping) => securityId && mapping.security_id?.trim().toUpperCase() === securityId,
  );
  if (exactSecurity) return exactSecurity;

  const exactIsin = mappings.find(
    (mapping) => isin && mapping.isin?.trim().toUpperCase() === isin,
  );
  if (exactIsin) return exactIsin;

  const symbolMatches = mappings.filter((mapping) => normalize(mapping.broker_symbol) === symbol);
  if (symbolMatches.length === 1) return symbolMatches[0];

  const genericSymbolMatches = symbolMatches.filter(
    (mapping) => !mapping.security_id?.trim() && !mapping.isin?.trim(),
  );
  if (!securityId && !isin && genericSymbolMatches.length === 1) {
    return genericSymbolMatches[0];
  }

  return undefined;
}

function likelyInvestmentLedger(override: LedgerOverride): boolean {
  return isLikelyStockLedgerCandidate(
    { name: override.name, group: override.parent_group },
    'INVESTMENT IN SHARES-ZERODHA',
  );
}

function buildCandidates(ledgerOverrides: LedgerOverride[]): TallyMappingCandidate[] {
  const seen = new Set<string>();
  const out: TallyMappingCandidate[] = [];

  for (const override of ledgerOverrides) {
    if (!likelyInvestmentLedger(override)) continue;
    const key = `${override.name.trim().toUpperCase()}|${override.parent_group.trim().toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: override.name, group: override.parent_group });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function confidenceFromResolver(value: string): TallyMappingPreviewConfidence {
  if (value === 'tally_alias') return 'alias';
  if (value === 'exact') return 'exact';
  if (value === 'pattern') return 'pattern';
  if (value === 'generated') return 'generated';
  return 'unmatched';
}

function statusForConfidence(confidence: TallyMappingPreviewConfidence): TallyMappingPreviewStatus {
  if (confidence === 'saved') return 'saved';
  if (confidence === 'exact' || confidence === 'alias' || confidence === 'pattern') {
    return 'suggested';
  }
  if (confidence === 'generated') return 'missing';
  return 'needs_review';
}

function addSecurity(securities: Map<string, SecurityRef>, ref: SecurityRef): void {
  const symbol = ref.broker_symbol.trim().toUpperCase();
  if (!symbol) return;

  const key = securityKey({
    broker_symbol: symbol,
    security_id: ref.security_id,
    isin: cleanIsin(ref.isin),
  });
  const current = securities.get(key);
  securities.set(key, {
    broker_symbol: symbol,
    security_id: current?.security_id ?? ref.security_id,
    isin: current?.isin ?? cleanIsin(ref.isin),
  });
}

function validSavedMapping(mapping: TallySecurityMapping): boolean {
  return isValidStockSecurityMapping({
    tally_ledger_name: mapping.tally_ledger_name,
    tally_ledger_group: mapping.tally_ledger_group,
    tally_stock_item_name: mapping.tally_stock_item_name,
  });
}

function extractSecuritiesFromFile(file: TallyMappingPreviewFile): SecurityRef[] {
  const type = file.detectedType ?? detectFileType(file.buffer, file.fileName);
  const securities = new Map<string, SecurityRef>();

  if (type === 'tradebook') {
    const parsed = parseTradebook(file.buffer, file.fileName);
    for (const row of parsed.rows) {
      const isin = cleanIsin(row.isin);
      addSecurity(securities, {
        broker_symbol: row.symbol,
        security_id: buildUnifiedSecurityId(row.exchange, row.symbol, isin, row.segment),
        isin,
      });
    }
  }

  if (type === 'taxpnl') {
    const parsed = parseTaxPnl(file.buffer, file.fileName);
    for (const row of parsed.exits) {
      const isin = cleanIsin(row.isin);
      addSecurity(securities, {
        broker_symbol: row.symbol,
        security_id: isin ? `ISIN:${isin}` : `EQ:${normalize(row.symbol)}`,
        isin,
      });
    }
    for (const row of parsed.open_positions) {
      const isin = cleanIsin(row.isin);
      addSecurity(securities, {
        broker_symbol: row.symbol,
        security_id: isin ? `ISIN:${isin}` : `EQ:${normalize(row.symbol)}`,
        isin,
      });
    }
  }

  return Array.from(securities.values());
}

export function buildTallyMappingPreview(params: {
  files: TallyMappingPreviewFile[];
  settings: UserSettings | null;
  accountingMode: 'investor' | 'trader';
  ledgerOverrides: LedgerOverride[];
  stockItems: TallyStockItemMapping[];
  securityMappings: TallySecurityMapping[];
}): TallyMappingPreviewResponse {
  const securities = new Map<string, SecurityRef>();
  for (const file of params.files) {
    for (const ref of extractSecuritiesFromFile(file)) {
      addSecurity(securities, ref);
    }
  }

  const profileMode = params.accountingMode === 'trader'
    ? AccountingMode.TRADER
    : AccountingMode.INVESTOR;
  const baseTallyProfile = getDefaultTallyProfile(profileMode);
  const tallyProfile = params.ledgerOverrides.length > 0
    ? mergeOverridesIntoProfile(baseTallyProfile, params.ledgerOverrides)
    : baseTallyProfile;
  const resolver = buildStockIdentityResolver({
    tallyProfile,
    stockItems: params.stockItems,
    ledgerOverrides: params.ledgerOverrides,
    securityMappings: [],
  });
  const candidates = buildCandidates(params.ledgerOverrides);

  const rows = Array.from(securities.values())
    .sort((a, b) => a.broker_symbol.localeCompare(b.broker_symbol))
    .map((ref): TallyMappingPreviewRow => {
      const saved = findSavedMapping(params.securityMappings, ref);
      if (saved && validSavedMapping(saved)) {
        return {
          broker_symbol: ref.broker_symbol,
          security_id: ref.security_id,
          isin: ref.isin,
          suggested_ledger_name: saved.tally_ledger_name,
          suggested_ledger_group: saved.tally_ledger_group,
          suggested_stock_item_name: saved.tally_stock_item_name,
          base_unit: saved.base_unit || 'NOS',
          confidence: 'saved',
          status: 'saved',
          candidates,
        };
      }

      const identity = resolver.resolve({
        symbol: ref.broker_symbol,
        securityId: ref.security_id,
        isin: ref.isin,
      });
      const confidence = confidenceFromResolver(identity.matchConfidence);
      return {
        broker_symbol: ref.broker_symbol,
        security_id: ref.security_id,
        isin: ref.isin,
        suggested_ledger_name: identity.investmentLedgerName,
        suggested_ledger_group: identity.investmentLedgerGroup,
        suggested_stock_item_name: identity.stockItemName,
        base_unit: identity.stockItemBaseUnit || 'NOS',
        confidence,
        status: statusForConfidence(confidence),
        candidates,
      };
    });

  return {
    rows,
    summary: {
      total: rows.length,
      saved: rows.filter((row) => row.status === 'saved').length,
      suggested: rows.filter((row) => row.status === 'suggested').length,
      needsReview: rows.filter((row) => row.status === 'needs_review').length,
      missing: rows.filter((row) => row.status === 'missing').length,
    },
  };
}
