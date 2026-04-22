export interface TallyImportArtifactNames {
  mastersFilename: string;
  transactionsFilename: string;
}

function toFilenameSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function deriveFYSuffix(from: string, to: string): string {
  if (!from || !to) return "";

  const fromYear = new Date(from).getFullYear();
  const toYear = new Date(to).getFullYear();
  if (Number.isNaN(fromYear) || Number.isNaN(toYear)) return "";

  return `FY${fromYear}-${String(toYear).slice(2)}`;
}

export function buildTallyImportArtifactNames(
  companyName: string,
  periodFrom: string,
  periodTo: string,
): TallyImportArtifactNames {
  const fySuffix = deriveFYSuffix(periodFrom, periodTo);
  const safeCompany = toFilenameSafe(companyName);

  return {
    mastersFilename:
      safeCompany && fySuffix
        ? `01_${safeCompany}_Ledger_Masters_${fySuffix}.xml`
        : "01_tally-masters.xml",
    transactionsFilename:
      safeCompany && fySuffix
        ? `02_${safeCompany}_Transactions_${fySuffix}.xml`
        : "02_tally-transactions.xml",
  };
}

export const TALLY_IMPORT_STEPS = [
  {
    title: "Import Masters First",
    detail:
      "In TallyPrime, go to Alt+O > Import > Masters and import the 01 masters file first.",
  },
  {
    title: "Import Transactions Second",
    detail:
      "After masters are imported, go to Alt+O > Import > Transactions and import the 02 transactions file.",
  },
  {
    title: "Why Order Matters",
    detail:
      "The masters import switches Journal voucher numbering to Manual so Tally keeps the contract note number instead of auto-numbering 1, 2, 3.",
  },
] as const;
