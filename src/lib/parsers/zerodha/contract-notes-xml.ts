/**
 * contract-notes-xml.ts
 * Parser for Zerodha contract notes in XML format (exported from Zerodha Console).
 *
 * XML structure:
 *   <contract_note version="0.1">
 *     <contracts>
 *       <contract>               ← one per trading day
 *         <id>CNT-23/24-...</id>
 *         <timestamp>YYYY-MM-DD</timestamp>
 *         <trades>
 *           <trade segment_id="NSE-EQ" instrument_id="NSE:SYMBOL - EQ / ISIN">
 *             <id>trade_no</id>
 *             <order_id>order_no</order_id>
 *             <timestamp>HH:MM:SS</timestamp>
 *             <type>B|S</type>
 *             <quantity>±n</quantity>     negative for sells
 *             <average_price>n</average_price>
 *             <value>±n</value>           negative for sells
 *           </trade>
 *         </trades>
 *         <grandtotals>          ← overall charges for the contract
 *           <grandtotal><name>Brokerage</name><value>n</value></grandtotal>
 *           ...
 *         </grandtotals>
 *       </contract>
 *     </contracts>
 *   </contract_note>
 */

import { XMLParser } from 'fast-xml-parser';
import type {
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
  ContractNoteParseResult,
} from './types';

export const PARSER_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  return s === 'None' ? '' : s;
}

function absStr(v: unknown): string {
  const s = str(v);
  if (!s) return '0';
  const n = parseFloat(s);
  return isNaN(n) ? '0' : String(Math.abs(n));
}

/** Ensure value is always an array (fast-xml-parser collapses single items). */
function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Extract exchange from segment_id e.g. "NSE-EQ " → "NSE" */
function exchangeFromSegment(segmentId: string): string {
  return segmentId.trim().split('-')[0] ?? '';
}

/** Charge name → charges field mapping (case-insensitive prefix match). */
const CHARGE_NAME_MAP: Record<string, keyof ChargeAccumulator> = {
  'pay in / pay out': 'pay_in_pay_out',
  'brokerage': 'brokerage',
  'exchange transaction charges': 'exchange_charges',
  'clearing charges': 'clearing_charges',
  'central gst': 'cgst',
  'state gst': 'sgst',
  'integrated gst': 'igst',
  'securities transaction tax': 'stt',
  'sebi turnover fees': 'sebi_fees',
  'stamp duty': 'stamp_duty',
  'net amount receivable': 'net_amount',
};

interface ChargeAccumulator {
  pay_in_pay_out: string;
  brokerage: string;
  exchange_charges: string;
  clearing_charges: string;
  cgst: string;
  sgst: string;
  igst: string;
  stt: string;
  sebi_fees: string;
  stamp_duty: string;
  net_amount: string;
}

function emptyCharges(): ChargeAccumulator {
  return {
    pay_in_pay_out: '0',
    brokerage: '0',
    exchange_charges: '0',
    clearing_charges: '0',
    cgst: '0',
    sgst: '0',
    igst: '0',
    stt: '0',
    sebi_fees: '0',
    stamp_duty: '0',
    net_amount: '0',
  };
}

function resolveChargeField(name: string): keyof ChargeAccumulator | null {
  const lower = name.toLowerCase().trim();
  for (const [prefix, field] of Object.entries(CHARGE_NAME_MAP)) {
    if (lower.startsWith(prefix)) return field;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseContractNotesXml(
  fileBuffer: Buffer,
  fileName: string,
): ContractNoteParseResult {
  const xml = fileBuffer.toString('utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    parseTagValue: true,
    trimValues: true,
    isArray: (tagName) =>
      ['contract', 'trade', 'grandtotal', 'charge', 'identity'].includes(tagName),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any;
  try {
    root = parser.parse(xml);
  } catch (e) {
    throw new Error(
      `Failed to parse XML contract note "${fileName}": ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const contractNote = root?.contract_note;
  if (!contractNote) {
    throw new Error(
      `File "${fileName}" does not appear to be a Zerodha XML contract note (missing <contract_note> root).`,
    );
  }

  const contracts = toArray(contractNote?.contracts?.contract);
  if (contracts.length === 0) {
    throw new Error(`XML contract note "${fileName}" contains no <contract> entries.`);
  }

  const trades: ZerodhaContractNoteTradeRow[] = [];
  const charges: ZerodhaContractNoteCharges[] = [];
  const tradesPerSheet: number[] = [];

  let minDate = '';
  let maxDate = '';

  for (const contract of contracts) {
    const contractNoteNo = str(contract.id);
    const tradeDate = str(contract.timestamp); // YYYY-MM-DD

    if (tradeDate) {
      if (!minDate || tradeDate < minDate) minDate = tradeDate;
      if (!maxDate || tradeDate > maxDate) maxDate = tradeDate;
    }

    // ---- Trades ----
    const contractTrades = toArray(contract?.trades?.trade);
    let tradesThisContract = 0;

    for (const t of contractTrades) {
      const segmentId: string = str(t['@_segment_id']);
      const instrumentId: string = str(t['@_instrument_id']);
      const rawQty = str(t.quantity);
      const rawType = str(t.type).toUpperCase();

      // buy_sell: explicit field takes precedence; fall back to quantity sign
      let buySell: 'B' | 'S';
      if (rawType === 'B' || rawType === 'S') {
        buySell = rawType as 'B' | 'S';
      } else {
        buySell = parseFloat(rawQty) < 0 ? 'S' : 'B';
      }

      // instrument_id format: "NSE:BOSCHLTD - EQ / ISIN123456789012"
      // Strip the exchange prefix so buildSecurityIdFromDescription receives just
      // the symbol portion (e.g. "BOSCHLTD - EQ / ISIN..."), otherwise the
      // downstream function produces a double-prefixed id like "NSE:NSE:BOSCHLTD".
      const colonIdx = instrumentId.indexOf(':');
      const symbolDescription = colonIdx >= 0 ? instrumentId.slice(colonIdx + 1) : instrumentId;

      const tradeRow: ZerodhaContractNoteTradeRow = {
        order_no: str(t.order_id),
        order_time: str(t.timestamp),
        trade_no: str(t.id),
        trade_time: str(t.timestamp),
        security_description: symbolDescription,
        buy_sell: buySell,
        quantity: absStr(t.quantity),
        exchange: exchangeFromSegment(segmentId),
        gross_rate: absStr(t.average_price),
        brokerage_per_unit: '0',
        net_rate: absStr(t.average_price),
        net_total: absStr(t.value),
        segment: segmentId.trim(),
      };

      trades.push(tradeRow);
      tradesThisContract++;
    }

    tradesPerSheet.push(tradesThisContract);

    // ---- Charges (from grandtotals) ----
    const acc = emptyCharges();
    const grandtotals = toArray(contract?.grandtotals?.grandtotal);

    for (const gt of grandtotals) {
      const name = str(gt.name);
      const value = str(gt.value);
      const field = resolveChargeField(name);
      if (field) {
        acc[field] = value || '0';
      }
    }

    const chargesRow: ZerodhaContractNoteCharges = {
      contract_note_no: contractNoteNo,
      trade_date: tradeDate,
      settlement_no: '',
      pay_in_pay_out: acc.pay_in_pay_out,
      brokerage: acc.brokerage,
      exchange_charges: acc.exchange_charges,
      clearing_charges: acc.clearing_charges,
      cgst: acc.cgst,
      sgst: acc.sgst,
      igst: acc.igst,
      stt: acc.stt,
      sebi_fees: acc.sebi_fees,
      stamp_duty: acc.stamp_duty,
      net_amount: acc.net_amount,
    };

    charges.push(chargesRow);
  }

  return {
    trades,
    charges,
    tradesPerSheet,
    metadata: {
      row_count: trades.length,
      date_range:
        minDate && maxDate ? { from: minDate, to: maxDate } : null,
      parser_version: PARSER_VERSION,
    },
  };
}
