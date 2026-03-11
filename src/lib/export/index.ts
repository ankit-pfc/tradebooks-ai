/**
 * index.ts
 * Barrel file — re-exports all public symbols from the TradeBooks AI
 * Tally export module.
 *
 * Usage:
 *   import { generateFullExport, collectRequiredLedgers, generateManifest }
 *     from '@/lib/export';
 */

// Tally XML generation (masters + vouchers).
export {
  generateMastersXml,
  generateVouchersXml,
  generateFullExport,
} from './tally-xml';

export type {
  LedgerMasterInput,
  VoucherDraftWithLines,
  FullExportResult,
} from './tally-xml';

// Ledger master collection from canonical events.
export {
  collectRequiredLedgers,
} from './ledger-masters';

export type {
  CollectLedgersOptions,
} from './ledger-masters';

// Import manifest generation and serialisation.
export {
  generateManifest,
  serializeManifest,
} from './manifest';

export type {
  GenerateManifestParams,
} from './manifest';
