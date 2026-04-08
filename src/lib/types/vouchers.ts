/**
 * vouchers.ts
 * Types for Tally voucher drafts and their constituent line items.
 * Monetary fields are decimal strings; use decimal.js for arithmetic at runtime.
 */

/**
 * Tally voucher type controlling the accounting entry format.
 * Maps directly to the voucher types available in Tally Prime / Tally ERP 9.
 */
export enum VoucherType {
  JOURNAL = 'JOURNAL',
  PURCHASE = 'PURCHASE',
  SALES = 'SALES',
  RECEIPT = 'RECEIPT',
  PAYMENT = 'PAYMENT',
  CONTRA = 'CONTRA',
}

/**
 * Lifecycle status of a voucher draft as it moves through review and export.
 * - DRAFT: generated but not yet reviewed.
 * - REVIEWED: reviewed and confirmed correct by a human or automated check.
 * - APPROVED: approved for export to Tally.
 * - EXPORTED: successfully imported into Tally.
 * - FAILED: export or validation failed; see associated exception for details.
 */
export enum VoucherStatus {
  DRAFT = 'DRAFT',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  EXPORTED = 'EXPORTED',
  FAILED = 'FAILED',
}

/**
 * Typed rendering intent for voucher exporters.
 * Keeps invoice-vs-accounting decisions out of narrative text.
 */
export enum InvoiceIntent {
  NONE = 'NONE',
  PURCHASE = 'PURCHASE',
  SALES = 'SALES',
}

/**
 * A single generated Tally voucher, potentially aggregating multiple canonical events
 * depending on the VoucherGranularity setting in the accounting profile.
 *
 * total_debit and total_credit must balance (be equal) for a valid double-entry voucher.
 */
export interface VoucherDraft {
  voucher_draft_id: string;
  import_batch_id: string;
  /** Tally voucher type that determines the entry screen in Tally. */
  voucher_type: VoucherType;
  /** Explicit invoice rendering intent for exporters. */
  invoice_intent?: InvoiceIntent;
  /** Voucher date in ISO-8601 format ("YYYY-MM-DD"). */
  voucher_date: string;
  /** External reference number shown in Tally (e.g. contract note number, order ID). */
  external_reference: string | null;
  /** Human-readable narration line included in the Tally voucher. */
  narrative: string | null;
  /** Sum of all debit lines as a decimal string. */
  total_debit: string;
  /** Sum of all credit lines as a decimal string. */
  total_credit: string;
  /** Current review / export status of this voucher. */
  draft_status: VoucherStatus;
  /** IDs of the CanonicalEvent records that contributed to this voucher. */
  source_event_ids: string[];
  created_at: string;
}

/**
 * A single debit or credit line within a VoucherDraft.
 * Each voucher has two or more lines that together form a balanced double-entry.
 *
 * Quantity, rate, and security fields are populated for stock/trade lines;
 * they are null for pure monetary lines such as charges or bank entries.
 */
export interface VoucherLine {
  voucher_line_id: string;
  voucher_draft_id: string;
  /** 1-based ordering of this line within the voucher. */
  line_no: number;
  /** Exact Tally ledger name this line posts to. */
  ledger_name: string;
  /** Line amount as a decimal string (always positive; direction is indicated by dr_cr). */
  amount: string;
  /** Whether this line is a debit or credit entry. */
  dr_cr: 'DR' | 'CR';
  /** FK to SecurityMaster; populated for stock/holdings lines, null for cash/charge lines. */
  security_id: string | null;
  /** Number of units for stock lines, as a decimal string. Null for non-stock lines. */
  quantity: string | null;
  /** Per-unit rate for stock lines, as a decimal string. Null for non-stock lines. */
  rate: string | null;
  /** Tally stock item name for inventory allocation. When set, an INVENTORYALLOCATIONS.LIST
   *  entry is emitted inside this ledger entry referencing this stock item.
   *  Defaults to ledger_name when null (backward-compat). */
  stock_item_name: string | null;
  /** Optional Tally cost centre tag for departmental reporting. */
  cost_center: string | null;
  /** Bill reference for Tally bill-by-bill tracking (e.g. invoice number). */
  bill_ref: string | null;
}
