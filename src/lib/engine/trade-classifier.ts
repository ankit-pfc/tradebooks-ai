import { AccountingMode } from '../types/accounting';

/**
 * Trade-level routing outcome used by the policy layer before voucher logic.
 *
 * PROFILE_DRIVEN is intentionally preserved for rows where broker data does not
 * provide enough signal to safely infer investor vs trader treatment. This
 * keeps backward compatibility with the current profile-driven engine flow.
 */
export enum TradeClassification {
    INVESTMENT = 'INVESTMENT',
    SPECULATIVE_BUSINESS = 'SPECULATIVE_BUSINESS',
    NON_SPECULATIVE_BUSINESS = 'NON_SPECULATIVE_BUSINESS',
    PROFILE_DRIVEN = 'PROFILE_DRIVEN',
}

const SPECULATIVE_PRODUCTS = new Set(['MIS', 'BO', 'CO']);
const INVESTMENT_PRODUCTS = new Set(['CNC', 'MTF']);
const NON_SPEC_PRODUCTS = new Set(['NRML']);

const DERIVATIVE_SEGMENT_MARKERS = [
    'F&O',
    'FO',
    'FUT',
    'OPT',
    'NFO',
    'BFO',
    'CDS',
    'COM',
    'COMMODITY',
] as const;

function normalize(value?: string): string {
    return value?.trim().toUpperCase() ?? '';
}

function isMcxExchange(exchange?: string): boolean {
    return normalize(exchange) === 'MCX';
}

function isDerivativeLikeSegment(segment?: string): boolean {
    const normalized = normalize(segment);
    return DERIVATIVE_SEGMENT_MARKERS.some((marker) => normalized.includes(marker));
}

/**
 * Classify a trade using broker routing hints.
 *
 * Priority order:
 * 1. MCX exchange override => always NON_SPECULATIVE_BUSINESS
 * 2. Explicit product codes
 * 3. Missing-product inference from derivative-like segments only
 * 4. PROFILE_DRIVEN fallback for ambiguous rows, especially equity cash rows
 */
export function classifyTrade(
    product?: string,
    segment?: string,
    exchange?: string,
): TradeClassification {
    if (isMcxExchange(exchange)) {
        return TradeClassification.NON_SPECULATIVE_BUSINESS;
    }

    const normalizedProduct = normalize(product);

    if (SPECULATIVE_PRODUCTS.has(normalizedProduct)) {
        return TradeClassification.SPECULATIVE_BUSINESS;
    }

    if (INVESTMENT_PRODUCTS.has(normalizedProduct)) {
        return TradeClassification.INVESTMENT;
    }

    if (NON_SPEC_PRODUCTS.has(normalizedProduct)) {
        return TradeClassification.NON_SPECULATIVE_BUSINESS;
    }

    if (!normalizedProduct) {
        if (isDerivativeLikeSegment(segment)) {
            return TradeClassification.NON_SPECULATIVE_BUSINESS;
        }

        return TradeClassification.PROFILE_DRIVEN;
    }

    return TradeClassification.PROFILE_DRIVEN;
}

/**
 * Map classification to the top-level accounting mode when the route is known.
 * Returns null for PROFILE_DRIVEN so existing client/profile defaults can take over.
 */
export function classificationToAccountingMode(
    classification: TradeClassification,
): AccountingMode | null {
    switch (classification) {
        case TradeClassification.INVESTMENT:
            return AccountingMode.INVESTOR;
        case TradeClassification.SPECULATIVE_BUSINESS:
        case TradeClassification.NON_SPECULATIVE_BUSINESS:
            return AccountingMode.TRADER;
        case TradeClassification.PROFILE_DRIVEN:
            return null;
    }
}