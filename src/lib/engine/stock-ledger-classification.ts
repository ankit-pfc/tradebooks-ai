export interface StockLedgerCandidate {
  name: string;
  group: string;
}

export interface StockSecurityMappingCandidate {
  tally_ledger_name: string;
  tally_ledger_group: string;
  tally_stock_item_name: string;
}

export function normalizeStockLedgerText(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeBrokerSymbolForLedger(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/-SH$/i, '')
    .replace(/-(EQ|BE|BZ|SM|ST|A|B|M|T|X)$/i, '');
}

function words(value: string): string[] {
  return value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function startsWithAny(value: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

export function isKnownNonStockLedgerName(name: string): boolean {
  const normalized = normalizeStockLedgerText(name);
  const parts = words(name);
  const first = parts[0] ?? '';
  const second = parts[1] ?? '';

  if (!normalized) return false;

  if (['STCG', 'LTCG', 'STCL', 'LTCL', 'GST', 'STT', 'TDS'].includes(first)) {
    return true;
  }

  if (first === 'DIV' || first === 'DIVIDEND') return true;
  if (first === 'AMC' && (second === 'CHARGES' || second === 'CHARGE')) return true;
  if (first === 'MISC' || first === 'MISCELLANEOUS') return true;
  if (first === 'BROKERAGE' || first === 'EXCHANGE' || first === 'SEBI' || first === 'STAMP') {
    return true;
  }
  if (first === 'DP' && (second === 'CHARGES' || second === 'CHARGE')) return true;
  if (first === 'DEMAT' && (second === 'CHARGES' || second === 'CHARGE' || second === 'AMC')) {
    return true;
  }
  if (first === 'SHARE' && second === 'BROKERAGE') return true;
  if (first === 'SECURITIES' && second === 'TRANSACTION') return true;
  if (first === 'TRADING' && second === 'SALES') return true;
  if (first === 'COST' && parts.includes('SHARES') && parts.includes('SOLD')) return true;

  return startsWithAny(normalized, [
    'STCGON',
    'LTCGON',
    'STCLON',
    'LTCLON',
    'SHAREBROKERAGE',
    'SECURITIESTRANSACTIONTAX',
    'DPCHARGES',
    'DEMATCHARGES',
    'DEMATAMCCHARGES',
    'AMCCHARGES',
    'MISCELLANEOUSCHARGES',
    'TRADINGSALES',
    'COSTOFSHARESSOLD',
  ]);
}

export function isKnownNonStockLedgerGroup(group: string): boolean {
  const normalized = normalizeStockLedgerText(group);
  const parts = words(group);
  const first = parts[0] ?? '';

  if (!normalized) return false;

  if (normalized.includes('INVESTMENT') || normalized.includes('STOCKINHAND') || normalized.includes('STOCKINTRADE')) {
    return false;
  }

  return (
    normalized === 'DIVONSHARES' ||
    first === 'DIV' ||
    first === 'DIVIDEND' ||
    normalized.includes('DUTIES') ||
    normalized.includes('TAX') ||
    normalized.includes('EXPENSE') ||
    normalized.includes('INCOME') ||
    normalized.includes('CAPITALGAIN')
  );
}

export function isLikelyStockLedgerCandidate(
  candidate: StockLedgerCandidate,
  profileInvestmentGroup: string,
): boolean {
  const group = normalizeStockLedgerText(candidate.group);
  const profileGroup = normalizeStockLedgerText(profileInvestmentGroup);
  const name = normalizeStockLedgerText(candidate.name);

  if (isKnownNonStockLedgerName(candidate.name)) return false;
  if (isKnownNonStockLedgerGroup(candidate.group)) return false;

  return (
    group === profileGroup ||
    group.includes('INVESTMENT') ||
    group.includes('STOCKINHAND') ||
    group.includes('STOCKINTRADE') ||
    name.endsWith('SH')
  );
}

export function isValidStockSecurityMapping(mapping: StockSecurityMappingCandidate): boolean {
  if (isKnownNonStockLedgerName(mapping.tally_ledger_name)) return false;
  if (isKnownNonStockLedgerName(mapping.tally_stock_item_name)) return false;
  if (isKnownNonStockLedgerGroup(mapping.tally_ledger_group)) return false;
  return true;
}
