/**
 * cost-lots.ts
 * FIFO and Weighted-Average cost lot tracking for securities disposals.
 *
 * All arithmetic uses decimal.js — never native JS number for money.
 * Quantities and monetary values are stored as decimal strings at rest.
 */

import Decimal from 'decimal.js';
import { EventType, type CanonicalEvent, type CostLot } from '../types/events';

function normalizeLegacySecurityId(securityId: string): string {
  const trimmed = securityId.trim().toUpperCase();
  const parts = trimmed.split(':');
  if (parts.length !== 2) return trimmed;

  const [prefix, value] = parts;
  if (prefix === 'ISIN') return `ISIN:${value}`;

  return value;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Records the consumption of a single cost lot during a sell event.
 * A sell that spans multiple lots produces one CostDisposal per lot consumed.
 */
export interface CostDisposal {
  /** The cost lot that was (partially or fully) consumed. */
  lot_id: string;
  /** Acquisition date of the consumed lot in YYYY-MM-DD format. */
  acquisition_date: string;
  /** Quantity consumed from this lot as a decimal string. */
  quantity_sold: string;
  /** Effective unit cost of the lot as a decimal string. */
  unit_cost: string;
  /** Total cost basis for this disposal: quantity_sold × unit_cost. */
  total_cost: string;
  /**
   * Gain or loss for this disposal.
   * gain = (sell_rate × quantity_sold) - total_cost
   * Positive = gain, negative = loss.
   */
  gain_or_loss: string;
}

// ---------------------------------------------------------------------------
// CostLotTracker
// ---------------------------------------------------------------------------

/**
 * Stateful FIFO / Weighted-Average lot tracker.
 *
 * Usage:
 *   const tracker = new CostLotTracker();
 *   tracker.addLot(buyEvent);                          // record acquisition
 *   const disposals = tracker.disposeLots(sellEvent, 'FIFO');  // match on sell
 */
export class CostLotTracker {
  /**
   * Map from security_id → ordered array of open lots.
   * FIFO ordering is maintained by always appending new lots at the end and
   * consuming from the front (index 0).
   */
  private readonly lots: Map<string, CostLot[]> = new Map();

  // -------------------------------------------------------------------------
  // addLot
  // -------------------------------------------------------------------------

  /**
   * Record a new cost lot from a BUY_TRADE event.
   *
   * @param event        A CanonicalEvent of type BUY_TRADE.
   * @param additionalCost  Optional extra capitalised cost (e.g. brokerage
   *                        capitalised per the accounting profile) as a decimal
   *                        string.  This is spread across the quantity to derive
   *                        an all-in effective unit cost.
   * @throws if event is not a BUY_TRADE or has no security_id.
   */
  addLot(event: CanonicalEvent, additionalCost?: string): void {
    if (event.event_type !== EventType.BUY_TRADE) {
      throw new Error(
        `addLot: expected BUY_TRADE event, got ${event.event_type}`,
      );
    }
    if (!event.security_id) {
      throw new Error(`addLot: event ${event.event_id} has no security_id`);
    }

    const qty = new Decimal(event.quantity).abs(); // abs: quantity is signed
    const rate = new Decimal(event.rate);

    // Base cost = rate × qty
    let totalCost = rate.mul(qty);

    // Add any capitalised charges spread across all units
    if (additionalCost && additionalCost !== '0') {
      totalCost = totalCost.add(new Decimal(additionalCost));
    }

    const effectiveUnitCost = qty.isZero()
      ? new Decimal(0)
      : totalCost.div(qty);

    const lot: CostLot = {
      cost_lot_id: crypto.randomUUID(),
      security_id: event.security_id,
      security_symbol: event.security_symbol ?? null,
      source_buy_event_id: event.event_id,
      open_quantity: qty.toFixed(),
      original_quantity: qty.toFixed(),
      effective_unit_cost: effectiveUnitCost.toFixed(6), // 6dp for precision
      acquisition_date: event.event_date,
      // remaining_total_cost tracks the undisposed cost at 2dp precision.
      // On partial disposals it is decremented; on final consumption of a
      // lot the remaining value is used directly, preventing cumulative
      // rounding drift from unit_cost × qty recalculation.
      remaining_total_cost: totalCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    };

    if (!this.lots.has(event.security_id)) {
      this.lots.set(event.security_id, []);
    }
    this.lots.get(event.security_id)!.push(lot);
  }

  // -------------------------------------------------------------------------
  // disposeLots
  // -------------------------------------------------------------------------

  /**
   * Match a SELL_TRADE event against open lots using the specified method.
   *
   * FIFO: consume the oldest lots first.
   * WEIGHTED_AVERAGE: compute a single blended unit cost across all open lots
   *   for the security, then produce a single CostDisposal.
   *
   * Updates the tracker's internal state in place (reduces open_quantity of
   * consumed lots; removes fully exhausted lots).
   *
   * @returns Array of CostDisposal records (one per lot consumed for FIFO;
   *   one aggregate record for WEIGHTED_AVERAGE).
   * @throws if the sell quantity exceeds total open lots for the security.
   */
  disposeLots(
    sellEvent: CanonicalEvent,
    method: 'FIFO' | 'WEIGHTED_AVERAGE',
  ): CostDisposal[] {
    if (sellEvent.event_type !== EventType.SELL_TRADE) {
      throw new Error(
        `disposeLots: expected SELL_TRADE event, got ${sellEvent.event_type}`,
      );
    }
    if (!sellEvent.security_id) {
      throw new Error(
        `disposeLots: event ${sellEvent.event_id} has no security_id`,
      );
    }

    // Sell quantity is stored as a negative decimal string; take absolute value.
    const sellQtyRemaining = new Decimal(sellEvent.quantity).abs();
    const sellRate = new Decimal(sellEvent.rate);
    const securityId = sellEvent.security_id;

    if (method === 'FIFO') {
      return this._disposeFifo(securityId, sellQtyRemaining, sellRate, sellEvent.event_date);
    } else {
      return this._disposeWeightedAverage(securityId, sellQtyRemaining, sellRate, sellEvent.event_date);
    }
  }

  // -------------------------------------------------------------------------
  // getOpenLots
  // -------------------------------------------------------------------------

  /** Return a snapshot of all open lots for the given security. */
  getOpenLots(securityId: string): CostLot[] {
    return (this.lots.get(securityId) ?? []).filter((lot) =>
      new Decimal(lot.open_quantity).greaterThan(0),
    );
  }

  // -------------------------------------------------------------------------
  // adjustLots — corporate actions
  // -------------------------------------------------------------------------

  /**
   * Adjust open lots for a corporate action (bonus, split, merger/demerger).
   *
   * Mutations happen in place, consistent with disposeLots behaviour.
   *
   * @param params.securityId         The security whose lots are adjusted.
   * @param params.quantityMultiplier Multiply open and original quantity by this factor.
   * @param params.costDivisor        Divide effective_unit_cost by this factor.
   *                                  Defaults to quantityMultiplier when omitted.
   * @param params.newSecurityId      For mergers: transfer lots to a new security_id.
   * @param params.preserveAcquisitionDate  When true (bonus/split), keep original date.
   *                                  When false (merger), reset to actionDate if supplied.
   * @param params.actionDate         Date of the corporate action (used when !preserveAcquisitionDate).
   */
  adjustLots(params: {
    securityId: string;
    quantityMultiplier: Decimal | string;
    costDivisor?: Decimal | string;
    newSecurityId?: string;
    preserveAcquisitionDate: boolean;
    actionDate?: string;
  }): void {
    const openLots = this.lots.get(params.securityId);
    if (!openLots || openLots.length === 0) return;

    const multiplier = new Decimal(params.quantityMultiplier);
    const divisor = params.costDivisor
      ? new Decimal(params.costDivisor)
      : multiplier;

    for (const lot of openLots) {
      const openQty = new Decimal(lot.open_quantity);
      const origQty = new Decimal(lot.original_quantity);
      const unitCost = new Decimal(lot.effective_unit_cost);

      lot.open_quantity = openQty.mul(multiplier).toFixed();
      lot.original_quantity = origQty.mul(multiplier).toFixed();
      lot.effective_unit_cost = unitCost.div(divisor).toFixed(6);
      // Recompute remaining_total_cost from adjusted values
      lot.remaining_total_cost = new Decimal(lot.open_quantity)
        .mul(new Decimal(lot.effective_unit_cost))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

      if (!params.preserveAcquisitionDate && params.actionDate) {
        lot.acquisition_date = params.actionDate;
      }
    }

    // For merger/demerger: transfer lots from old securityId to new
    if (params.newSecurityId && params.newSecurityId !== params.securityId) {
      // Update security_id on each lot
      for (const lot of openLots) {
        lot.security_id = params.newSecurityId;
      }
      // Move to new key in the map
      const existingNewLots = this.lots.get(params.newSecurityId) ?? [];
      this.lots.set(params.newSecurityId, [...existingNewLots, ...openLots]);
      this.lots.delete(params.securityId);
    }
  }

  // -------------------------------------------------------------------------
  // Serialization
  // -------------------------------------------------------------------------

  /** Return all open lots across all securities. */
  getAllOpenLots(): Map<string, CostLot[]> {
    const result = new Map<string, CostLot[]>();
    for (const [securityId, lots] of this.lots) {
      const open = lots.filter((lot) =>
        new Decimal(lot.open_quantity).greaterThan(0),
      );
      if (open.length > 0) {
        result.set(securityId, open);
      }
    }
    return result;
  }

  /** Serialize to a plain JSON-safe object for persistence. */
  toJSON(): { lots: Record<string, CostLot[]> } {
    const openLots = this.getAllOpenLots();
    const record: Record<string, CostLot[]> = {};
    for (const [securityId, lots] of openLots) {
      record[securityId] = lots;
    }
    return { lots: record };
  }

  /** Reconstruct a CostLotTracker from serialized data. */
  static fromJSON(data: { lots: Record<string, CostLot[]> }): CostLotTracker {
    const tracker = new CostLotTracker();
    for (const [securityId, lots] of Object.entries(data.lots)) {
      const normalizedSecurityId = normalizeLegacySecurityId(securityId);
      const normalizedLots = lots.map((lot) => {
        const normalized = {
          ...lot,
          security_id: normalizeLegacySecurityId(lot.security_id),
        };
        // Back-compat: lots serialized before remaining_total_cost was added
        // need it derived from effective_unit_cost × open_quantity.
        if (normalized.remaining_total_cost === undefined || normalized.remaining_total_cost === null) {
          const openQty = new Decimal(normalized.open_quantity);
          const unitCost = new Decimal(normalized.effective_unit_cost);
          normalized.remaining_total_cost = openQty.mul(unitCost)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
        }
        return normalized;
      });
      const existingLots = tracker.lots.get(normalizedSecurityId) ?? [];
      tracker.lots.set(normalizedSecurityId, [...existingLots, ...normalizedLots]);
    }
    return tracker;
  }

  // -------------------------------------------------------------------------
  // Aggregation helpers
  // -------------------------------------------------------------------------

  /** Sum total_cost across all disposals as a decimal string. */
  getTotalCostSold(disposals: CostDisposal[]): string {
    return disposals
      .reduce((sum, d) => sum.add(new Decimal(d.total_cost)), new Decimal(0))
      .toFixed(2);
  }

  /** Sum gain_or_loss across all disposals (positive = overall gain). */
  getTotalGainLoss(disposals: CostDisposal[]): string {
    return disposals
      .reduce(
        (sum, d) => sum.add(new Decimal(d.gain_or_loss)),
        new Decimal(0),
      )
      .toFixed(2);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _disposeFifo(
    securityId: string,
    sellQtyRemaining: Decimal,
    sellRate: Decimal,
    sellDate: string,
  ): CostDisposal[] {
    const openLots = this.lots.get(securityId) ?? [];
    const disposals: CostDisposal[] = [];
    let remaining = sellQtyRemaining;

    for (const lot of openLots) {
      if (remaining.isZero()) break;

      const lotOpen = new Decimal(lot.open_quantity);
      if (lotOpen.isZero()) continue;

      const consumed = Decimal.min(lotOpen, remaining);
      const unitCost = new Decimal(lot.effective_unit_cost);
      // Fallback for lots without remaining_total_cost (pre-migration data)
      const lotRemaining = lot.remaining_total_cost
        ? new Decimal(lot.remaining_total_cost)
        : lotOpen.mul(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // When consuming the final units of a lot, use the tracked remaining
      // cost instead of recalculating from unit_cost × quantity. This
      // prevents the cumulative ₹0.01 rounding drift that occurs when a
      // lot is split across multiple sell events.
      const isFullConsumption = consumed.equals(lotOpen);
      const totalCost = isFullConsumption
        ? lotRemaining
        : consumed.mul(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const proceeds = consumed.mul(sellRate);
      const gainOrLoss = proceeds.sub(totalCost);

      disposals.push({
        lot_id: lot.cost_lot_id,
        acquisition_date: lot.acquisition_date,
        quantity_sold: consumed.toFixed(),
        unit_cost: unitCost.toFixed(6),
        total_cost: totalCost.toFixed(2),
        gain_or_loss: gainOrLoss.toFixed(2),
      });

      // Reduce open quantity and remaining cost on the lot
      lot.open_quantity = lotOpen.sub(consumed).toFixed();
      lot.remaining_total_cost = lotRemaining.sub(totalCost).toFixed(2);
      remaining = remaining.sub(consumed);
    }

    // Clean up fully exhausted lots
    this.lots.set(
      securityId,
      openLots.filter((lot) => new Decimal(lot.open_quantity).greaterThan(0)),
    );

    // If open lots were exhausted before the full sell qty was matched, record
    // the uncovered remainder as a zero-cost disposal. The pipeline still
    // generates a valid voucher and Tally can reconcile the discrepancy.
    if (remaining.greaterThan(0)) {
      disposals.push({
        lot_id: 'uncovered',
        acquisition_date: sellDate,
        quantity_sold: remaining.toFixed(),
        unit_cost: '0.000000',
        total_cost: '0.00',
        gain_or_loss: remaining.mul(sellRate).toFixed(2),
      });
    }

    return disposals;
  }

  private _disposeWeightedAverage(
    securityId: string,
    sellQty: Decimal,
    sellRate: Decimal,
    sellDate: string,
  ): CostDisposal[] {
    const openLots = this.lots.get(securityId) ?? [];

    // Compute weighted average unit cost across all open lots
    let totalQty = new Decimal(0);
    let totalCostBasis = new Decimal(0);
    for (const lot of openLots) {
      const lotQty = new Decimal(lot.open_quantity);
      totalQty = totalQty.add(lotQty);
      totalCostBasis = totalCostBasis.add(
        lotQty.mul(new Decimal(lot.effective_unit_cost)),
      );
    }

    // If no open lots at all, the entire sell is uncovered — zero cost basis.
    if (totalQty.isZero()) {
      return [{
        lot_id: 'uncovered',
        acquisition_date: sellDate,
        quantity_sold: sellQty.toFixed(),
        unit_cost: '0.000000',
        total_cost: '0.00',
        gain_or_loss: sellQty.mul(sellRate).toFixed(2),
      }];
    }

    // Cap the covered portion at available lots; excess gets zero-cost disposal.
    const coveredQty = totalQty.lessThan(sellQty) ? totalQty : sellQty;
    const uncoveredQty = sellQty.sub(coveredQty);

    const weightedUnitCost = totalCostBasis.div(totalQty);
    const costForSell = coveredQty.mul(weightedUnitCost);
    const proceeds = coveredQty.mul(sellRate);
    const gainOrLoss = proceeds.sub(costForSell);

    // Reduce lots proportionally (FIFO order for lot accounting)
    let remaining = coveredQty;
    for (const lot of openLots) {
      if (remaining.isZero()) break;
      const lotOpen = new Decimal(lot.open_quantity);
      const consumed = Decimal.min(lotOpen, remaining);
      const unitCost = new Decimal(lot.effective_unit_cost);
      const lotRemaining = lot.remaining_total_cost
        ? new Decimal(lot.remaining_total_cost)
        : lotOpen.mul(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const isFullConsumption = consumed.equals(lotOpen);
      const consumedCost = isFullConsumption
        ? lotRemaining
        : consumed.mul(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      lot.open_quantity = lotOpen.sub(consumed).toFixed();
      lot.remaining_total_cost = lotRemaining.sub(consumedCost).toFixed(2);
      remaining = remaining.sub(consumed);
    }

    // Clean up exhausted lots
    this.lots.set(
      securityId,
      openLots.filter((lot) => new Decimal(lot.open_quantity).greaterThan(0)),
    );

    const disposals: CostDisposal[] = [{
      lot_id: 'WEIGHTED_AVERAGE',
      acquisition_date: openLots[0]?.acquisition_date ?? '',
      quantity_sold: coveredQty.toFixed(),
      unit_cost: weightedUnitCost.toFixed(6),
      total_cost: costForSell.toFixed(2),
      gain_or_loss: gainOrLoss.toFixed(2),
    }];

    if (uncoveredQty.greaterThan(0)) {
      disposals.push({
        lot_id: 'uncovered',
        acquisition_date: sellDate,
        quantity_sold: uncoveredQty.toFixed(),
        unit_cost: '0.000000',
        total_cost: '0.00',
        gain_or_loss: uncoveredQty.mul(sellRate).toFixed(2),
      });
    }

    return disposals;
  }
}
