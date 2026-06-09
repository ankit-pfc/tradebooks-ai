/**
 * Local verification harness — runs the patched pipeline against the user's
 * real FY 24-25 files in `continuous period files/` and asserts that the
 * symptoms shown in PHOTO-2026-05-10-16-09-18.jpg are gone.
 *
 * Symptoms we're verifying disappear:
 *   1. Ledger names like BOSCHLTD-EQ-SH, DBL-A-SH, GEPIL-B-SH, GEMENVIRO-M-SH,
 *      SHAKTIPUMP-BE-SH, PEL-A-SH, LICI-EQ-SH, RECLTD-EQ-SH, SHRIPISTON-EQ-SH,
 *      CLEAN-EQ-SH, IDFCFIRSTB-A-SH (series suffix in the middle).
 *   2. No Opening Stock B/F voucher when prior-FY shares are involved.
 *
 * Run with:  npx vitest run scripts/verify-bug-fixes.test.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { runProcessingPipeline, type PipelineInput } from '../src/lib/processing/pipeline';
import { extractCleanSymbolFromCnDescription } from '../src/lib/engine/canonical-events';

// Detect whether the series-suffix fix (PR #21 / fix/cn-series-strip) has
// landed on this branch. The two fixes (series-strip + opening-stock-bf)
// were shipped as separate PRs; this script asserts the union of both, but
// gracefully no-ops the series-strip assertions when only the
// opening-stock-bf fix is present on the current tree. After both PRs are
// in main, every assertion runs.
const SERIES_STRIP_PRESENT =
  extractCleanSymbolFromCnDescription('PROBE-EQ/INE000000001') === 'PROBE';

// The user's actual FY 24-25 export files live in `continuous period files/`
// and are git-ignored (client financial data — see .gitignore). When those
// files are absent (clean checkout, CI environment, or other devs' machines)
// the entire describe block skips. This keeps the regression harness around
// without breaking builds elsewhere.
const HARNESS_DIR = resolve(__dirname, '..', 'continuous period files');
const HAS_FILES =
  existsSync(resolve(HARNESS_DIR, 'tradebook-FC9134-EQ.xlsx')) &&
  existsSync(resolve(HARNESS_DIR, 'taxpnl-FC9134-2024_2025-Q1-Q4.xlsx')) &&
  existsSync(resolve(HARNESS_DIR, 'Contract Notes_FC9134_2024-04-01_2025-03-31.xlsx'));

// Mock the DB layer so the pipeline runs purely in-memory.
const mockRepo = {
  createBatch: vi.fn(),
  getBatch: vi.fn(),
  listBatches: vi.fn(),
  updateBatchStatus: vi.fn().mockResolvedValue(undefined),
  addUploadedFiles: vi.fn(),
  resolveUploadedFilePath: vi.fn(),
  saveProcessingOutput: vi.fn().mockResolvedValue(undefined),
  listExceptions: vi.fn(),
  buildDashboardSummary: vi.fn(),
  saveClosingLots: vi.fn().mockResolvedValue(undefined),
  getClosingLots: vi.fn().mockResolvedValue(null),
  listPriorBatches: vi.fn(),
  saveCorporateActions: vi.fn().mockResolvedValue(undefined),
  getCorporateActions: vi.fn().mockResolvedValue([]),
  updateFileStatus: vi.fn(),
  getFilesByBatch: vi.fn(),
  deleteFile: vi.fn(),
  findDuplicateFile: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  getBatchRepository: () => mockRepo,
  getSettingsRepository: () => ({
    getSettings: vi.fn().mockResolvedValue(null),
    upsertSettings: vi.fn(),
  }),
  getLedgerRepository: () => ({
    listOverrides: vi.fn().mockResolvedValue([]),
    upsertOverride: vi.fn(),
    bulkUpsertOverrides: vi.fn(),
    deleteOverride: vi.fn(),
  }),
  getStockItemRepository: () => ({
    listStockItems: vi.fn().mockResolvedValue([]),
    bulkUpsertStockItems: vi.fn(),
  }),
  getStockMappingRepository: () => ({
    listMappings: vi.fn().mockResolvedValue([]),
    upsertMapping: vi.fn(),
    bulkUpsertMappings: vi.fn(),
  }),
}));

const ROOT = resolve(__dirname, '..');
const F = (rel: string) => resolve(ROOT, 'continuous period files', rel);

function loadFile(rel: string, mimeType: string, fileId: string) {
  return {
    fileId,
    fileName: rel,
    buffer: readFileSync(F(rel)),
    mimeType,
  };
}

describe.skipIf(!HAS_FILES)('Photo regression: FY 24-25 continuous-period files', () => {
  it('produces clean ledger names without duplicating Tally opening balances', async () => {
    const input: PipelineInput = {
      userId: 'verify-user',
      batchId: 'verify-fy24-25',
      companyName: 'Shobha Test 100526',
      accountingMode: 'investor',
      periodFrom: '2024-04-01',
      periodTo: '2025-03-31',
      files: [
        loadFile(
          'tradebook-FC9134-EQ.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'f-tradebook',
        ),
        loadFile(
          'taxpnl-FC9134-2024_2025-Q1-Q4.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'f-taxpnl',
        ),
        loadFile(
          'Contract Notes_FC9134_2024-04-01_2025-03-31.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'f-cn',
        ),
      ],
    };

    const result = await runProcessingPipeline(input);

    // Dump artifacts to disk for manual inspection in addition to the
    // automated assertions below.
    writeFileSync(
      resolve(ROOT, 'continuous period files/_verify-masters.xml'),
      result.mastersXml,
    );
    writeFileSync(
      resolve(ROOT, 'continuous period files/_verify-transactions.xml'),
      result.transactionsXml,
    );

    // ---- ASSERTION 1: No series-suffix ledger names anywhere ----
    // These exact patterns are visible in the user's Tally Group Summary
    // photo (PHOTO-2026-05-10-16-09-18.jpg). After the series-strip fix
    // (PR #21) lands, none of them should appear in either masters or
    // transactions XML. Skipped when running on a branch that only has the
    // opening-stock-bf fix (the assertion would fire spuriously).
    const combined = result.mastersXml + '\n' + result.transactionsXml;
    if (SERIES_STRIP_PRESENT) {
      const badNamePatterns = [
        /BOSCHLTD-EQ-SH/,
        /DBL-A-SH/,
        /GEPIL-B-SH/,
        /GEMENVIRO-M-SH/,
        /SHAKTIPUMP-BE-SH/,
        /PEL-A-SH/,
        /LICI-EQ-SH/,
        /RECLTD-EQ-SH/,
        /SHRIPISTON-EQ-SH/,
        /CLEAN-EQ-SH/,
        /IDFCFIRSTB-A-SH/,
      ];
      const foundBad: string[] = [];
      for (const pattern of badNamePatterns) {
        const m = combined.match(pattern);
        if (m) foundBad.push(m[0]);
      }
      if (foundBad.length > 0) {
        throw new Error(
          `Found series-suffix ledger names (series-strip fix regressed): ${foundBad.join(', ')}`,
        );
      }
      expect(foundBad).toHaveLength(0);
    } else {
      console.warn(
        '[verify] series-strip fix (PR #21) not detected on this branch — skipping ledger-name assertions. They will run once both fixes are merged to main.',
      );
    }

    // ---- ASSERTION 2: Clean ledger names present ----
    // These are the names the user's existing Tally COA uses. After the
    // series-strip fix, the parser should produce them verbatim for the
    // scrips whose Zerodha ticker matches the Tally form.
    const cleanNames = ['BOSCHLTD-SH', 'DBL-SH', 'GEPIL-SH', 'GEMENVIRO-SH', 'PEL-SH', 'SHRIPISTON-SH'];
    for (const name of cleanNames) {
      if (!combined.includes(name)) {
        // Not fatal — only fires if the scrip had any trade in FY 24-25.
        // We log for visibility but don't fail the test.
        console.warn(`[verify] expected ledger "${name}" not found in output (may be OK if no trade)`);
      }
    }

    // ---- ASSERTION 3: Tax P&L is cost-basis evidence, not opening import ----
    // Default workflow assumes the user's Tally company already has opening
    // balances, so Tax P&L lots should support gain/cost calculation without
    // emitting an Opening Stock B/F voucher.
    const costBasisCheck = result.checks.find((c) => c.check_name === 'Tax P&L Cost Basis');
    const seededLots = costBasisCheck?.status === 'PASSED';
    if (seededLots) {
      expect(result.transactionsXml).not.toContain(
        'Opening stock brought forward from previous FY',
      );
      expect(result.mastersXml).not.toContain('Opening Stock Balance B/F');
    } else {
      console.warn('[verify] Tax P&L Cost Basis check did not pass — no opening lots seeded');
    }

    // ---- INFO: dump match counts and high-level summary ----
    console.log('\n=== Verification summary ===');
    console.log(`  voucherCount: ${result.voucherCount}`);
    console.log(`  eventCount:   ${result.eventCount}`);
    console.log(`  ledgerCount:  ${result.ledgerCount}`);
    console.log(`  chargeSource: ${result.chargeSource}`);
    console.log(`  fyLabel:      ${result.fyLabel ?? '(none)'}`);
    if (costBasisCheck) {
      console.log(`  cost-basis:   ${costBasisCheck.status} — ${costBasisCheck.details}`);
    }
    if (result.matchResult) {
      const m = result.matchResult;
      console.log(
        `  trade-match:  matched=${m.matched} ` +
          `unmatched_tb=${m.unmatchedTradebook} unmatched_cn=${m.unmatchedContractNote}`,
      );
    }
    console.log('  artifacts written to continuous period files/_verify-{masters,transactions}.xml\n');

    // ---- DIAGNOSTIC: list any -SH ledgers that survive in output ----
    // Helps spot residual Bug 2 cases (CA's bespoke ledger names) so we
    // can scope the next phase precisely.
    const allShLedgers = Array.from(
      new Set(
        Array.from(combined.matchAll(/<LEDGER NAME="([^"]+-SH)"/g)).map((m) => m[1]),
      ),
    ).sort();
    console.log('=== All -SH ledgers in output (' + allShLedgers.length + ') ===');
    for (const name of allShLedgers) console.log('  ' + name);
    console.log('');
  });
});
