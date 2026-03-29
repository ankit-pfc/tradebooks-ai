/**
 * Shared test factory functions for creating canonical events, parser rows,
 * voucher drafts, and file buffers used across multiple test files.
 */
import { EventType, type CanonicalEvent } from '../../lib/types/events';
import { VoucherType, VoucherStatus, type VoucherDraft, type VoucherLine } from '../../lib/types/vouchers';
import type {
  ZerodhaTradebookRow,
  ZerodhaFundsStatementRow,
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
  ZerodhaDividendRow,
  ZerodhaHoldingsRow,
  CorporateActionInput,
} from '../../lib/parsers/zerodha/types';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Canonical Event factories
// ---------------------------------------------------------------------------

export function makeEvent(
  overrides: Partial<CanonicalEvent> & { event_type: EventType },
): CanonicalEvent {
  const { event_type, ...rest } = overrides;
  return {
    event_id: crypto.randomUUID(),
    import_batch_id: 'batch-1',
    event_type,
    event_date: '2024-06-15',
    settlement_date: null,
    security_id: 'NSE:RELIANCE',
    quantity: '10',
    rate: '2500.00',
    gross_amount: '25000.00',
    charge_type: null,
    charge_amount: '0',
    source_file_id: 'file-1',
    source_row_ids: ['r1'],
    contract_note_ref: null,
    external_ref: null,
    event_hash: `hash-${crypto.randomUUID().slice(0, 8)}`,
    ...rest,
  };
}

export function makeBuyEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return makeEvent({ event_type: EventType.BUY_TRADE, ...overrides });
}

export function makeSellEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return makeEvent({
    event_type: EventType.SELL_TRADE,
    quantity: '-10',
    rate: '2600.00',
    gross_amount: '26000.00',
    ...overrides,
  });
}

export function makeChargeEvent(
  eventType: EventType,
  amount: string,
  securityId: string | null = 'NSE:RELIANCE',
  extra: Partial<CanonicalEvent> = {},
): CanonicalEvent {
  return makeEvent({
    event_type: eventType,
    security_id: securityId,
    quantity: '0',
    rate: '0',
    gross_amount: '0',
    charge_type: eventType,
    charge_amount: amount,
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// Parser row factories
// ---------------------------------------------------------------------------

export function makeTradebookRow(overrides: Partial<ZerodhaTradebookRow> = {}): ZerodhaTradebookRow {
  return {
    trade_date: '2024-06-15',
    exchange: 'NSE',
    segment: 'EQ',
    symbol: 'RELIANCE',
    isin: 'INE002A01018',
    trade_type: 'buy',
    quantity: '10',
    price: '2500.00',
    trade_id: 'T001',
    order_id: 'O001',
    order_execution_time: '10:30:00',
    ...overrides,
  };
}

export function makeFundsRow(overrides: Partial<ZerodhaFundsStatementRow> = {}): ZerodhaFundsStatementRow {
  return {
    posting_date: '2024-06-15',
    segment: 'EQ',
    description: 'Funds transfer',
    debit: '0',
    credit: '25000.00',
    running_balance: '25000.00',
    instrument: null,
    ...overrides,
  };
}

export function makeCnTrade(overrides: Partial<ZerodhaContractNoteTradeRow> = {}): ZerodhaContractNoteTradeRow {
  return {
    order_no: 'O001',
    order_time: '10:30:00',
    trade_no: 'T001',
    trade_time: '10:30:05',
    security_description: 'RELIANCE INDUSTRIES LTD',
    buy_sell: 'B',
    quantity: '10',
    exchange: 'NSE',
    gross_rate: '2500.00',
    brokerage_per_unit: '0.03',
    net_rate: '2500.03',
    net_total: '25000.30',
    segment: 'EQ',
    ...overrides,
  };
}

export function makeCnCharges(overrides: Partial<ZerodhaContractNoteCharges> = {}): ZerodhaContractNoteCharges {
  return {
    contract_note_no: 'CN001',
    trade_date: '2024-06-15',
    settlement_no: 'S001',
    pay_in_pay_out: '2024-06-17',
    brokerage: '0.30',
    exchange_charges: '3.25',
    clearing_charges: '0',
    cgst: '0.32',
    sgst: '0.32',
    igst: '0',
    stt: '2.50',
    sebi_fees: '0.25',
    stamp_duty: '3.75',
    net_amount: '25010.69',
    ...overrides,
  };
}

export function makeDividendRow(overrides: Partial<ZerodhaDividendRow> = {}): ZerodhaDividendRow {
  return {
    symbol: 'RELIANCE',
    isin: 'INE002A01018',
    ex_date: '2024-08-15',
    quantity: '100',
    dividend_per_share: '10.00',
    net_dividend_amount: '900.00',
    ...overrides,
  };
}

export function makeHoldingsRow(overrides: Partial<ZerodhaHoldingsRow> = {}): ZerodhaHoldingsRow {
  return {
    symbol: 'RELIANCE',
    isin: 'INE002A01018',
    sector: 'Oil & Gas',
    quantity_available: '100',
    quantity_discrepant: '0',
    quantity_long_term: '100',
    quantity_pledged_margin: '0',
    quantity_pledged_loan: '0',
    average_price: '2500.00',
    previous_closing_price: '2600.00',
    unrealized_pnl: '10000.00',
    unrealized_pnl_pct: '4.00',
    ...overrides,
  };
}

export function makeCorporateAction(overrides: Partial<CorporateActionInput> = {}): CorporateActionInput {
  return {
    action_type: 'BONUS',
    security_id: 'NSE:RELIANCE',
    action_date: '2024-07-01',
    ratio_numerator: '1',
    ratio_denominator: '2',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Voucher factories
// ---------------------------------------------------------------------------

export function makeVoucherLine(overrides: Partial<VoucherLine> = {}): VoucherLine {
  return {
    voucher_line_id: crypto.randomUUID(),
    voucher_draft_id: 'v-1',
    line_no: 1,
    ledger_name: 'Test Ledger',
    amount: '25000.00',
    dr_cr: 'DR',
    security_id: null,
    quantity: null,
    rate: null,
    cost_center: null,
    bill_ref: null,
    ...overrides,
  };
}

export function makeVoucherDraft(
  overrides: Partial<VoucherDraft> = {},
): VoucherDraft {
  return {
    voucher_draft_id: crypto.randomUUID(),
    import_batch_id: 'batch-1',
    voucher_type: VoucherType.JOURNAL,
    voucher_date: '2024-06-15',
    external_reference: null,
    narrative: null,
    total_debit: '25000.00',
    total_credit: '25000.00',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// File buffer builders
// ---------------------------------------------------------------------------

/** Create an in-memory XLSX buffer from sheet data (array-of-arrays per sheet). */
export function buildXlsxBuffer(sheets: Record<string, (string | number | null)[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/** Create a CSV buffer from rows. */
export function buildCsvBuffer(rows: string[][]): Buffer {
  const csv = rows.map(r => r.join(',')).join('\n');
  return Buffer.from(csv, 'utf-8');
}

/** Create a CSV buffer with UTF-8 BOM prefix. */
export function buildCsvBufferWithBom(rows: string[][]): Buffer {
  const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
  return Buffer.from(csv, 'utf-8');
}
