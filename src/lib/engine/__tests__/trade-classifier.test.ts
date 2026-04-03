import { describe, expect, it } from 'vitest';
import { AccountingMode } from '../../types/accounting';
import {
    TradeClassification,
    classifyTrade,
    classificationToAccountingMode,
} from '../trade-classifier';

describe('classifyTrade', () => {
    it('routes CNC to INVESTMENT', () => {
        expect(classifyTrade('CNC', 'EQ', 'NSE')).toBe(TradeClassification.INVESTMENT);
    });

    it('routes MIS to SPECULATIVE_BUSINESS', () => {
        expect(classifyTrade('MIS', 'EQ', 'NSE')).toBe(TradeClassification.SPECULATIVE_BUSINESS);
    });

    it('routes BO to SPECULATIVE_BUSINESS', () => {
        expect(classifyTrade('BO', 'EQ', 'NSE')).toBe(TradeClassification.SPECULATIVE_BUSINESS);
    });

    it('routes CO to SPECULATIVE_BUSINESS', () => {
        expect(classifyTrade('CO', 'EQ', 'NSE')).toBe(TradeClassification.SPECULATIVE_BUSINESS);
    });

    it('routes NRML equity to NON_SPECULATIVE_BUSINESS', () => {
        expect(classifyTrade('NRML', 'EQ', 'NSE')).toBe(TradeClassification.NON_SPECULATIVE_BUSINESS);
    });

    it('routes NRML F&O to NON_SPECULATIVE_BUSINESS', () => {
        expect(classifyTrade('NRML', 'NFO-FUT', 'NSE')).toBe(TradeClassification.NON_SPECULATIVE_BUSINESS);
    });

    it('routes MTF to INVESTMENT by default', () => {
        expect(classifyTrade('MTF', 'EQ', 'NSE')).toBe(TradeClassification.INVESTMENT);
    });

    it('applies MCX override even when product is CNC', () => {
        expect(classifyTrade('CNC', 'COM', 'MCX')).toBe(TradeClassification.NON_SPECULATIVE_BUSINESS);
    });

    it('applies MCX override even when product is MIS', () => {
        expect(classifyTrade('MIS', 'COM', 'MCX')).toBe(TradeClassification.NON_SPECULATIVE_BUSINESS);
    });

    it('infers missing-product derivative segment as NON_SPECULATIVE_BUSINESS', () => {
        expect(classifyTrade(undefined, 'NFO-OPT', 'NSE')).toBe(TradeClassification.NON_SPECULATIVE_BUSINESS);
    });

    it('infers missing-product commodity segment as NON_SPECULATIVE_BUSINESS', () => {
        expect(classifyTrade(undefined, 'COMMODITY', 'NSE')).toBe(TradeClassification.NON_SPECULATIVE_BUSINESS);
    });

    it('falls back to PROFILE_DRIVEN for missing-product equity row', () => {
        expect(classifyTrade(undefined, 'EQ', 'NSE')).toBe(TradeClassification.PROFILE_DRIVEN);
    });

    it('falls back to PROFILE_DRIVEN for fully missing routing hints', () => {
        expect(classifyTrade(undefined, undefined, undefined)).toBe(TradeClassification.PROFILE_DRIVEN);
    });

    it('treats lowercase and padded inputs case-insensitively', () => {
        expect(classifyTrade('  mtf ', ' eq ', ' nse ')).toBe(TradeClassification.INVESTMENT);
    });

    it('falls back to PROFILE_DRIVEN for unknown product on equity segment', () => {
        expect(classifyTrade('XYZ', 'EQ', 'NSE')).toBe(TradeClassification.PROFILE_DRIVEN);
    });
});

describe('classificationToAccountingMode', () => {
    it('maps INVESTMENT to INVESTOR', () => {
        expect(classificationToAccountingMode(TradeClassification.INVESTMENT)).toBe(AccountingMode.INVESTOR);
    });

    it('maps SPECULATIVE_BUSINESS to TRADER', () => {
        expect(classificationToAccountingMode(TradeClassification.SPECULATIVE_BUSINESS)).toBe(AccountingMode.TRADER);
    });

    it('maps NON_SPECULATIVE_BUSINESS to TRADER', () => {
        expect(classificationToAccountingMode(TradeClassification.NON_SPECULATIVE_BUSINESS)).toBe(AccountingMode.TRADER);
    });

    it('returns null for PROFILE_DRIVEN fallback', () => {
        expect(classificationToAccountingMode(TradeClassification.PROFILE_DRIVEN)).toBeNull();
    });
});