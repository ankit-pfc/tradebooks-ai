/**
 * off-market-auction.test.ts
 * Tests for Phase 3c: Off-Market Transfers and Auction Adjustments
 *
 * Covers:
 *  - buildOffMarketTransferVoucher() — DRAFT template with suspense
 *  - buildAuctionAdjustmentVoucher() — gain/loss computation
 *  - buildVouchers() — switch wiring for both event types
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { EventType, type CanonicalEvent } from '../../types/events';
import { VoucherStatus } from '../../types/vouchers';
import {
  buildOffMarketTransferVoucher,
  buildAuctionAdjustmentVoucher,
  buildVouchers,
} from '../voucher-builder';
import { CostLotTracker, type CostDisposal } from '../cost-lots';
import {
  AccountingMode,
  ChargeTreatment,
  VoucherGranularity,
  LedgerStrategy,
  CostBasisMethod,
} from '../../types/accounting';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<CanonicalEvent>): CanonicalEvent {
  return {
    event_id: crypto.randomUUID(),
    import_batch_id: 'batch-1',
    event_type: EventType.OFF_MARKET_TRANSFER,
    event_date: '2025-06-01',
    settlement_date: null,
    security_id: 'NSE:RELIANCE',
    quantity: '-100',
    rate: '200',
    gross_amount: '20000.00',
    charge_type: null,
    charge_amount: '0',
    source_file_id: 'file-1',
    source_row_ids: [],
    contract_note_ref: null,
    external_ref: null,
    event_hash: 'hash-1',
    ...overrides,
  };
}

const DEFAULT_PROFILE = {
  accounting_profile_id: 'test-investor',
  profile_name: 'Test Investor',
  mode: AccountingMode.INVESTOR,
  charge_treatment: ChargeTreatment.EXPENSE,
  voucher_granularity: VoucherGranularity.TRADE_LEVEL,
  ledger_strategy: LedgerStrategy.SCRIPT_LEVEL,
  cost_basis_method: CostBasisMethod.FIFO,
  rounding_rules: { decimal_places: 2 },
};

// ---------------------------------------------------------------------------
// buildOffMarketTransferVoucher
// ---------------------------------------------------------------------------

describe('buildOffMarketTransferVoucher', () => {
  it('produces DRAFT status voucher', () => {
    const event = makeEvent({ event_type: EventType.OFF_MARKET_TRANSFER });
    const voucher = buildOffMarketTransferVoucher(event);

    expect(voucher.draft_status).toBe(VoucherStatus.DRAFT);
  });

  it('produces balanced voucher with suspense account', () => {
    const event = makeEvent({ event_type: EventType.OFF_MARKET_TRANSFER });
    const voucher = buildOffMarketTransferVoucher(event);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    const suspenseLine = voucher.lines.find(l =>
      l.ledger_name === 'Off-Market Transfer Suspense',
    );
    expect(suspenseLine).toBeDefined();
  });

  it('narrative contains REQUIRES MANUAL REVIEW', () => {
    const event = makeEvent({ event_type: EventType.OFF_MARKET_TRANSFER });
    const voucher = buildOffMarketTransferVoucher(event);

    expect(voucher.narrative).toContain('REQUIRES MANUAL REVIEW');
    expect(voucher.narrative).toContain('RELIANCE');
  });
});

// ---------------------------------------------------------------------------
// buildAuctionAdjustmentVoucher
// ---------------------------------------------------------------------------

describe('buildAuctionAdjustmentVoucher', () => {
  it('produces balanced voucher with gain', () => {
    const event = makeEvent({
      event_type: EventType.AUCTION_ADJUSTMENT,
      gross_amount: '25000.00',
    });
    const disposals: CostDisposal[] = [{
      lot_id: 'lot-1',
      acquisition_date: '2024-01-15',
      quantity_sold: '100',
      unit_cost: '200.000000',
      total_cost: '20000.00',
      gain_or_loss: '5000.00',
    }];

    const voucher = buildAuctionAdjustmentVoucher(event, disposals);

    expect(voucher.total_debit).toBe(voucher.total_credit);
    expect(voucher.narrative).toContain('Auction settlement');

    // CR line for gain
    const gainLine = voucher.lines.find(
      l => l.dr_cr === 'CR' && new Decimal(l.amount).equals(5000),
    );
    expect(gainLine).toBeDefined();
  });

  it('produces balanced voucher with loss', () => {
    const event = makeEvent({
      event_type: EventType.AUCTION_ADJUSTMENT,
      gross_amount: '15000.00',
    });
    const disposals: CostDisposal[] = [{
      lot_id: 'lot-1',
      acquisition_date: '2024-01-15',
      quantity_sold: '100',
      unit_cost: '200.000000',
      total_cost: '20000.00',
      gain_or_loss: '-5000.00',
    }];

    const voucher = buildAuctionAdjustmentVoucher(event, disposals);

    expect(voucher.total_debit).toBe(voucher.total_credit);

    // DR line for loss
    const lossLine = voucher.lines.find(
      l => l.dr_cr === 'DR' && new Decimal(l.amount).equals(5000),
    );
    expect(lossLine).toBeDefined();
  });

  it('handles zero cost basis (no lots)', () => {
    const event = makeEvent({
      event_type: EventType.AUCTION_ADJUSTMENT,
      gross_amount: '10000.00',
    });
    const disposals: CostDisposal[] = [{
      lot_id: 'UNKNOWN',
      acquisition_date: '2024-06-15',
      quantity_sold: '100',
      unit_cost: '0',
      total_cost: '0',
      gain_or_loss: '10000.00',
    }];

    const voucher = buildAuctionAdjustmentVoucher(event, disposals);

    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

// ---------------------------------------------------------------------------
// buildVouchers integration
// ---------------------------------------------------------------------------

describe('buildVouchers off-market/auction integration', () => {
  it('handles OFF_MARKET_TRANSFER in switch without throwing', () => {
    const omtEvent = makeEvent({
      event_type: EventType.OFF_MARKET_TRANSFER,
      event_date: '2025-06-01',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers([omtEvent], DEFAULT_PROFILE, tracker);

    expect(vouchers).toHaveLength(1);
    expect(vouchers[0].total_debit).toBe(vouchers[0].total_credit);
  });

  it('handles AUCTION_ADJUSTMENT in switch without throwing', () => {
    const auctionEvent = makeEvent({
      event_type: EventType.AUCTION_ADJUSTMENT,
      event_date: '2025-06-01',
      gross_amount: '10000.00',
      quantity: '-100',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers([auctionEvent], DEFAULT_PROFILE, tracker);

    expect(vouchers).toHaveLength(1);
    expect(vouchers[0].total_debit).toBe(vouchers[0].total_credit);
  });

  it('deducts cost basis for AUCTION_ADJUSTMENT when matching lots are available', () => {
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      event_date: '2025-01-01',
      quantity: '100',
      rate: '200',
      gross_amount: '20000.00',
    });
    const auctionEvent = makeEvent({
      event_type: EventType.AUCTION_ADJUSTMENT,
      event_date: '2025-06-01',
      quantity: '-100',
      rate: '250',
      gross_amount: '25000.00',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers([buyEvent, auctionEvent], DEFAULT_PROFILE, tracker);
    const auctionVoucher = vouchers.find((voucher) =>
      voucher.source_event_ids.includes(auctionEvent.event_id),
    );

    expect(auctionVoucher).toBeDefined();
    expect(auctionVoucher?.total_debit).toBe(auctionVoucher?.total_credit);
    expect(
      auctionVoucher?.lines.some((line) =>
        line.dr_cr === 'CR' &&
        line.security_id === 'NSE:RELIANCE' &&
        new Decimal(line.amount).equals(20000),
      ),
    ).toBe(true);
    expect(
      auctionVoucher?.lines.some((line) =>
        line.dr_cr === 'CR' && new Decimal(line.amount).equals(5000),
      ),
    ).toBe(true);
  });

  it('uses an uncovered disposal for AUCTION_ADJUSTMENT when no lots are available', () => {
    const auctionEvent = makeEvent({
      event_type: EventType.AUCTION_ADJUSTMENT,
      event_date: '2025-06-01',
      quantity: '-100',
      rate: '100',
      gross_amount: '10000.00',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers([auctionEvent], DEFAULT_PROFILE, tracker);
    const auctionVoucher = vouchers[0];

    expect(auctionVoucher.total_debit).toBe(auctionVoucher.total_credit);
    expect(
      auctionVoucher.lines.some((line) =>
        line.dr_cr === 'CR' &&
        line.security_id === 'NSE:RELIANCE' &&
        new Decimal(line.amount).equals(0),
      ),
    ).toBe(true);
    expect(
      auctionVoucher.lines.some((line) =>
        line.dr_cr === 'CR' && new Decimal(line.amount).equals(10000),
      ),
    ).toBe(true);
  });

  it('throws for AUCTION_ADJUSTMENT with missing security_id', () => {
    const auctionEvent = makeEvent({
      event_type: EventType.AUCTION_ADJUSTMENT,
      event_date: '2025-06-01',
      security_id: null,
      gross_amount: '10000.00',
      quantity: '-100',
    });

    const tracker = new CostLotTracker();

    expect(() => buildVouchers([auctionEvent], DEFAULT_PROFILE, tracker)).toThrow(
      'has no security_id',
    );
  });

  it('handles mixed events including all new types', () => {
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      event_date: '2025-01-01',
      quantity: '100',
      rate: '200',
      gross_amount: '20000.00',
    });
    const omtEvent = makeEvent({
      event_type: EventType.OFF_MARKET_TRANSFER,
      event_date: '2025-03-01',
    });
    const divEvent = makeEvent({
      event_type: EventType.DIVIDEND,
      event_date: '2025-04-01',
      gross_amount: '500.00',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(
      [buyEvent, omtEvent, divEvent],
      DEFAULT_PROFILE,
      tracker,
    );

    // buy + off-market + dividend = 3 vouchers
    expect(vouchers).toHaveLength(3);
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
  });
});
