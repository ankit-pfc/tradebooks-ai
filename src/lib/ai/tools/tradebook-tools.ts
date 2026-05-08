import Decimal from 'decimal.js';
import { tool } from 'ai';
import { z } from 'zod';
import { getBatchRepository } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/file-storage';
import { detectFileType } from '@/lib/parsers/zerodha/detect';
import { parseTradebook } from '@/lib/parsers/zerodha/tradebook';
import { parseContractNotes } from '@/lib/parsers/zerodha/contract-notes';
import { parseContractNotesXml } from '@/lib/parsers/zerodha/contract-notes-xml';
import { parseFundsStatement } from '@/lib/parsers/zerodha/funds-statement';
import { parseDividends } from '@/lib/parsers/zerodha/dividends';
import { parseHoldings } from '@/lib/parsers/zerodha/holdings';
import { parseLedger } from '@/lib/parsers/zerodha/ledger';
import type { BatchDetail, BatchFileMeta, BatchFileType } from '@/lib/types/domain';
import type { ZerodhaTradebookRow } from '@/lib/parsers/zerodha/types';

export interface TradebookAgentContext {
  userId: string;
  batchId: string;
}

interface ParsedTradebookFile {
  file: BatchFileMeta;
  rows: ZerodhaTradebookRow[];
  dateRange: { from: string; to: string } | null | undefined;
}

function getContext(context: unknown): TradebookAgentContext {
  if (
    typeof context === 'object' &&
    context !== null &&
    'userId' in context &&
    'batchId' in context &&
    typeof context.userId === 'string' &&
    typeof context.batchId === 'string'
  ) {
    return {
      userId: context.userId,
      batchId: context.batchId,
    };
  }

  throw new Error('Missing authenticated batch context');
}

async function getAuthorizedBatch(context: unknown): Promise<BatchDetail> {
  const { userId, batchId } = getContext(context);
  const repo = getBatchRepository();
  const batch = await repo.getBatch(batchId);

  if (!batch) {
    throw new Error(`Batch not found: ${batchId}`);
  }
  if (batch.user_id !== userId) {
    throw new Error('Forbidden');
  }

  return batch;
}

async function downloadBatchFile(batchId: string, file: BatchFileMeta): Promise<Buffer> {
  const repo = getBatchRepository();
  const storagePath = await repo.resolveUploadedFilePath(batchId, file.id);
  if (!storagePath) {
    throw new Error(`Storage path missing for file ${file.file_name}`);
  }
  return getFileStorage().download(storagePath);
}

function serializeBatch(batch: BatchDetail) {
  return {
    id: batch.id,
    companyName: batch.company_name,
    accountingMode: batch.accounting_mode,
    periodFrom: batch.period_from,
    periodTo: batch.period_to,
    fyLabel: batch.fy_label ?? null,
    status: batch.status,
    statusMessage: batch.status_message,
    fileCount: batch.file_count,
    voucherCount: batch.voucher_count,
    createdAt: batch.created_at,
    updatedAt: batch.updated_at,
    files: batch.files.map((file) => ({
      id: file.id,
      fileName: file.file_name,
      detectedType: file.detected_type,
      status: file.status,
      sizeBytes: file.size_bytes,
      uploadedAt: file.uploaded_at,
      errorMessage: file.error_message,
    })),
    processingResult: batch.processing_result,
    exceptions: batch.exceptions.map((exception) => ({
      code: exception.code,
      severity: exception.severity,
      message: exception.message,
      sourceRefs: exception.source_refs,
      createdAt: exception.created_at,
    })),
  };
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function addDecimal(a: string, b: Decimal): string {
  return new Decimal(a || '0').plus(b).toFixed(2);
}

function tradeValue(row: ZerodhaTradebookRow): Decimal {
  return new Decimal(row.quantity || '0').mul(row.price || '0').abs();
}

async function loadParsedTradebooks(context: unknown): Promise<ParsedTradebookFile[]> {
  const batch = await getAuthorizedBatch(context);
  const tradebookFiles = batch.files.filter(
    (file) => file.status === 'uploaded' && file.detected_type === 'tradebook',
  );

  const parsed: ParsedTradebookFile[] = [];
  for (const file of tradebookFiles) {
    const buffer = await downloadBatchFile(batch.id, file);
    const result = parseTradebook(buffer, file.file_name);
    parsed.push({
      file,
      rows: result.rows,
      dateRange: result.metadata.date_range,
    });
  }

  return parsed;
}

export const tradebookAgentTools = {
  getBatchOverview: tool({
    description:
      'Get the selected batch metadata, uploaded file list, persisted processing summary, checks, and exceptions.',
    inputSchema: z.object({}),
    execute: async (_input, { experimental_context }) => {
      const batch = await getAuthorizedBatch(experimental_context);
      return serializeBatch(batch);
    },
  }),

  getProcessingChecks: tool({
    description:
      'Get reconciliation and processing checks for the selected batch. Use this for questions about warnings, failures, or import readiness.',
    inputSchema: z.object({}),
    execute: async (_input, { experimental_context }) => {
      const batch = await getAuthorizedBatch(experimental_context);
      return {
        batchId: batch.id,
        status: batch.status,
        statusMessage: batch.status_message,
        summary: batch.processing_result?.summary ?? null,
        checks: batch.processing_result?.checks ?? [],
        exceptions: batch.exceptions.map((exception) => ({
          code: exception.code,
          severity: exception.severity,
          message: exception.message,
          sourceRefs: exception.source_refs,
        })),
      };
    },
  }),

  analyzeUploadedFiles: tool({
    description:
      'Parse uploaded files in memory and return compact row counts, date ranges, and parser diagnostics. Does not persist extracted rows.',
    inputSchema: z.object({}),
    execute: async (_input, { experimental_context }) => {
      const batch = await getAuthorizedBatch(experimental_context);
      const uploadedFiles = batch.files.filter((file) => file.status === 'uploaded');
      const files: Array<{
        fileName: string;
        detectedType: BatchFileType;
        rowCount: number | null;
        dateRange: { from: string; to: string } | null;
        notes: string[];
      }> = [];

      for (const file of uploadedFiles) {
        const notes: string[] = [];
        try {
          const buffer = await downloadBatchFile(batch.id, file);
          const detectedType = detectFileType(buffer, file.file_name) as BatchFileType;
          let rowCount: number | null = null;
          let dateRange: { from: string; to: string } | null = null;

          if (detectedType === 'tradebook') {
            const parsed = parseTradebook(buffer, file.file_name);
            rowCount = parsed.rows.length;
            dateRange = parsed.metadata.date_range ?? null;
          } else if (detectedType === 'contract_note') {
            const parsed = buffer[0] === 0x3c
              ? parseContractNotesXml(buffer, file.file_name)
              : parseContractNotes(buffer, file.file_name);
            rowCount = parsed.trades.length;
            dateRange = parsed.metadata.date_range ?? null;
            if (parsed.diagnostics && parsed.diagnostics.length > 0) {
              notes.push(...parsed.diagnostics);
            }
          } else if (detectedType === 'funds_statement') {
            const parsed = parseFundsStatement(buffer, file.file_name);
            rowCount = parsed.rows.length;
            dateRange = parsed.metadata.date_range ?? null;
          } else if (detectedType === 'dividends') {
            const parsed = parseDividends(buffer, file.file_name);
            rowCount = parsed.rows.length;
            dateRange = parsed.metadata.date_range ?? null;
          } else if (detectedType === 'holdings') {
            const parsed = parseHoldings(buffer, file.file_name);
            rowCount = parsed.equity.length + parsed.mutual_funds.length;
            dateRange = parsed.metadata.date_range ?? null;
          } else if (detectedType === 'ledger') {
            const parsed = parseLedger(buffer, file.file_name);
            rowCount = parsed.rows.length;
            dateRange = parsed.metadata.date_range ?? null;
          }

          files.push({
            fileName: file.file_name,
            detectedType,
            rowCount,
            dateRange,
            notes,
          });
        } catch (error) {
          files.push({
            fileName: file.file_name,
            detectedType: file.detected_type,
            rowCount: null,
            dateRange: null,
            notes: [error instanceof Error ? error.message : 'Unable to parse file'],
          });
        }
      }

      return {
        batchId: batch.id,
        files,
        persistedFileCount: batch.file_count,
      };
    },
  }),

  computeTradebookMetrics: tool({
    description:
      'Compute deterministic tradebook metrics such as buy/sell counts, turnover, product mix, and top traded symbols.',
    inputSchema: z.object({
      topN: z.number().int().min(1).max(25).optional().default(10),
    }),
    execute: async ({ topN }, { experimental_context }) => {
      const parsedFiles = await loadParsedTradebooks(experimental_context);
      const rows = parsedFiles.flatMap((file) => file.rows);

      const symbolMetrics = new Map<
        string,
        {
          symbol: string;
          tradeCount: number;
          buyCount: number;
          sellCount: number;
          buyQuantity: string;
          sellQuantity: string;
          buyValue: string;
          sellValue: string;
        }
      >();

      let buyCount = 0;
      let sellCount = 0;
      let buyValue = '0';
      let sellValue = '0';

      for (const row of rows) {
        const current = symbolMetrics.get(row.symbol) ?? {
          symbol: row.symbol,
          tradeCount: 0,
          buyCount: 0,
          sellCount: 0,
          buyQuantity: '0',
          sellQuantity: '0',
          buyValue: '0',
          sellValue: '0',
        };

        const quantity = new Decimal(row.quantity || '0').abs();
        const value = tradeValue(row);
        current.tradeCount += 1;

        if (row.trade_type === 'buy') {
          buyCount += 1;
          buyValue = addDecimal(buyValue, value);
          current.buyCount += 1;
          current.buyQuantity = new Decimal(current.buyQuantity).plus(quantity).toString();
          current.buyValue = addDecimal(current.buyValue, value);
        } else {
          sellCount += 1;
          sellValue = addDecimal(sellValue, value);
          current.sellCount += 1;
          current.sellQuantity = new Decimal(current.sellQuantity).plus(quantity).toString();
          current.sellValue = addDecimal(current.sellValue, value);
        }

        symbolMetrics.set(row.symbol, current);
      }

      return {
        files: parsedFiles.map((file) => ({
          fileName: file.file.file_name,
          rowCount: file.rows.length,
          dateRange: file.dateRange ?? null,
        })),
        totalTrades: rows.length,
        buyCount,
        sellCount,
        grossBuyValue: buyValue,
        grossSellValue: sellValue,
        grossTradeValue: addDecimal(buyValue, new Decimal(sellValue)),
        productBreakdown: countBy(rows.map((row) => row.product ?? 'MISSING_PRODUCT')),
        segmentBreakdown: countBy(rows.map((row) => row.segment || 'UNKNOWN_SEGMENT')),
        topSymbols: Array.from(symbolMetrics.values())
          .sort((a, b) => b.tradeCount - a.tradeCount)
          .slice(0, topN),
      };
    },
  }),

  getClosingLots: tool({
    description:
      'Get the selected batch closing lot snapshot, if processing saved one. Use for questions about remaining open quantities after processing.',
    inputSchema: z.object({}),
    execute: async (_input, { experimental_context }) => {
      const batch = await getAuthorizedBatch(experimental_context);
      const lots = await getBatchRepository().getClosingLots(batch.id);
      return {
        batchId: batch.id,
        lotCount: lots ? Object.values(lots).reduce((sum, entries) => sum + entries.length, 0) : 0,
        lots: lots ?? {},
      };
    },
  }),
};
