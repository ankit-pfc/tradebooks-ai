import Decimal from 'decimal.js';
import { detectFileType } from '@/lib/parsers/zerodha/detect';
import { parseTradebook } from '@/lib/parsers/zerodha/tradebook';
import { parseContractNotes } from '@/lib/parsers/zerodha/contract-notes';
import { parseContractNotesXml } from '@/lib/parsers/zerodha/contract-notes-xml';
import {
  buildCanonicalEvents,
  pairContractNoteData,
} from '@/lib/engine/canonical-events';
import { CostLotTracker } from '@/lib/engine/cost-lots';
import { buildVouchers } from '@/lib/engine/voucher-builder';
import {
  INVESTOR_DEFAULT,
  getDefaultTallyProfile,
} from '@/lib/engine/accounting-policy';
import { AccountingMode } from '@/lib/types/accounting';
import { collectRequiredLedgers } from '@/lib/export/ledger-masters';
import { generateFullExport } from '@/lib/export/tally-xml';
import { matchTrades } from '@/lib/engine/trade-matcher';
import { runFullReconciliation } from '@/lib/reconciliation/checks';
import { TradeClassificationStrategy } from '@/lib/engine/trade-classifier';
import { EventType } from '@/lib/types/events';

export interface ExplainModeInput {
  tradebookBuffer: Buffer;
  tradebookFileName: string;
  contractNoteBuffer?: Buffer;
  contractNoteFileName?: string;
  classificationStrategy?: TradeClassificationStrategy;
  companyName?: string;
  batchId?: string;
}

export interface ExplainModeOutput {
  metadata: {
    classification_strategy: TradeClassificationStrategy;
    company_name: string;
    batch_id: string;
  };
  snapshots: {
    parsed_rows: {
      tradebook_first_row: unknown;
      contract_note_first_trade: unknown;
      contract_note_first_charge: unknown;
    };
    joined_trade: {
      matched: number;
      unmatched_tradebook: number;
      unmatched_contract_note: number;
    } | null;
    canonical_events: {
      first_trade_event: unknown;
      related_events: unknown[];
    };
    posting_events: {
      first_related_voucher: unknown;
    };
    fifo: {
      closing_lots: Record<string, unknown>;
    };
    reconciliation: ReturnType<typeof runFullReconciliation>;
    xml: {
      masters_preview: string;
      transactions_preview: string;
    };
    totals: {
      event_count: number;
      voucher_count: number;
      first_trade_gross_amount: string | null;
    };
  };
}

function formatAmount(amount: string): string {
  return new Decimal(amount).toFixed(2);
}

export function explainSingleTradePath(input: ExplainModeInput): ExplainModeOutput {
  const classificationStrategy =
    input.classificationStrategy ?? TradeClassificationStrategy.STRICT_PRODUCT;
  const companyName = input.companyName ?? 'Explain Debug Co';
  const batchId = input.batchId ?? 'explain-batch';

  const parsedTradebook = parseTradebook(input.tradebookBuffer, input.tradebookFileName);

  let parsedContractNote:
    | {
      trades: ReturnType<typeof parseContractNotes>['trades'];
      charges: ReturnType<typeof parseContractNotes>['charges'];
      tradesPerSheet?: ReturnType<typeof parseContractNotes>['tradesPerSheet'];
    }
    | undefined;

  if (input.contractNoteBuffer && input.contractNoteFileName) {
    const detectedType = detectFileType(input.contractNoteBuffer, input.contractNoteFileName);
    if (detectedType !== 'contract_note') {
      throw new Error(`Expected contract_note file type, received ${detectedType}`);
    }

    const parsed = input.contractNoteBuffer[0] === 0x3c
      ? parseContractNotesXml(input.contractNoteBuffer, input.contractNoteFileName)
      : parseContractNotes(input.contractNoteBuffer, input.contractNoteFileName);

    parsedContractNote = {
      trades: parsed.trades,
      charges: parsed.charges,
      tradesPerSheet: parsed.tradesPerSheet,
    };
  }

  const contractNoteSheets = parsedContractNote
    ? pairContractNoteData(
      parsedContractNote.trades,
      parsedContractNote.charges,
      parsedContractNote.tradesPerSheet,
    )
    : [];

  const events = buildCanonicalEvents({
    tradebookRows: parsedTradebook.rows,
    contractNoteSheets,
    batchId,
    fileIds: {
      tradebook: 'tradebook-file',
      contractNote: contractNoteSheets.length > 0 ? 'contract-note-file' : undefined,
    },
    classificationStrategy,
    deterministicIds: true,
  });

  const tallyProfile = getDefaultTallyProfile(AccountingMode.INVESTOR);
  const tracker = new CostLotTracker();
  const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker, tallyProfile);
  const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT, { tallyProfile });
  const { mastersXml, transactionsXml } = generateFullExport(
    vouchers,
    ledgers,
    companyName,
    tallyProfile.customGroups,
  );

  const tradeEvents = events.filter(
    (event) => event.event_type === EventType.BUY_TRADE || event.event_type === EventType.SELL_TRADE,
  );
  const firstTrade = tradeEvents[0];
  const relatedEvents = firstTrade
    ? events.filter((event) => event.source_row_ids.some((rowId) => firstTrade.source_row_ids.includes(rowId)))
    : [];
  const relatedVoucher = firstTrade
    ? vouchers.find((voucher) => voucher.source_event_ids.includes(firstTrade.event_id)) ?? null
    : null;

  const cnTradesWithDate = contractNoteSheets.flatMap((sheet) =>
    sheet.trades.map((trade) => ({ trade, tradeDate: sheet.charges.trade_date })),
  );
  const tradeMatch = cnTradesWithDate.length > 0
    ? matchTrades(parsedTradebook.rows, cnTradesWithDate)
    : null;

  const reconciliation = runFullReconciliation({
    events,
    vouchers,
    rawTradebookRows: parsedTradebook.rows as unknown as Record<string, unknown>[],
    contractNoteCharges: parsedContractNote?.charges,
    tradeMatchResult: tradeMatch ?? undefined,
  });

  return {
    metadata: {
      classification_strategy: classificationStrategy,
      company_name: companyName,
      batch_id: batchId,
    },
    snapshots: {
      parsed_rows: {
        tradebook_first_row: parsedTradebook.rows[0] ?? null,
        contract_note_first_trade: parsedContractNote?.trades[0] ?? null,
        contract_note_first_charge: parsedContractNote?.charges[0] ?? null,
      },
      joined_trade: tradeMatch
        ? {
          matched: tradeMatch.matched.length,
          unmatched_tradebook: tradeMatch.unmatchedTradebook.length,
          unmatched_contract_note: tradeMatch.unmatchedContractNote.length,
        }
        : null,
      canonical_events: {
        first_trade_event: firstTrade ?? null,
        related_events: relatedEvents,
      },
      posting_events: {
        first_related_voucher: relatedVoucher,
      },
      fifo: {
        closing_lots: tracker.toJSON().lots,
      },
      reconciliation,
      xml: {
        masters_preview: mastersXml.slice(0, 2000),
        transactions_preview: transactionsXml.slice(0, 2000),
      },
      totals: {
        event_count: events.length,
        voucher_count: vouchers.length,
        first_trade_gross_amount: firstTrade ? formatAmount(firstTrade.gross_amount) : null,
      },
    },
  };
}
