import { describe, expect, it } from 'vitest';
import { buildStockIdentityResolver } from '@/lib/engine/stock-identity-resolver';
import { INVESTOR_TALLY_DEFAULT } from '@/lib/engine/accounting-policy';
import type { LedgerOverride } from '@/lib/db/ledger-repository';

function ledger(name: string, parentGroup = 'INVESTMENT IN SHARES-ZERODHA'): LedgerOverride {
  return {
    id: `ledger-${name}`,
    user_id: 'user-001',
    ledger_key: name.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
    name,
    parent_group: parentGroup,
    is_custom: true,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('buildStockIdentityResolver — ledger-only Tally masters', () => {
  it('matches broker symbols with exchange-series suffixes to existing Tally investment ledgers', () => {
    const resolver = buildStockIdentityResolver({
      tallyProfile: INVESTOR_TALLY_DEFAULT,
      stockItems: [],
      ledgerOverrides: [
        ledger('BOSCH LIMITED'),
        ledger('BOSCHLTD-SH'),
        ledger('National Aluminium Co'),
        ledger('REC-SH'),
        ledger('WIPRO-SH'),
        ledger('STCG ON NATIONALUM', 'Capital Account'),
      ],
    });

    expect(resolver.resolve({ symbol: 'BOSCHLTD-EQ' })).toMatchObject({
      investmentLedgerName: 'BOSCHLTD-SH',
      stockItemName: 'BOSCHLTD-SH',
      matchConfidence: 'pattern',
    });

    expect(resolver.resolve({ symbol: 'NATIONALUM-A' })).toMatchObject({
      investmentLedgerName: 'National Aluminium Co',
      stockItemName: 'National Aluminium Co',
      matchConfidence: 'pattern',
    });

    expect(resolver.resolve({ symbol: 'RECLTD-EQ' })).toMatchObject({
      investmentLedgerName: 'REC-SH',
      stockItemName: 'REC-SH',
      matchConfidence: 'pattern',
    });

    expect(resolver.resolve({ symbol: 'WIPRO-EQ' })).toMatchObject({
      investmentLedgerName: 'WIPRO-SH',
      stockItemName: 'WIPRO-SH',
      matchConfidence: 'pattern',
    });
  });

  it('does not treat AMC, GST, STT, charge, or gain ledgers as stock identities', () => {
    const resolver = buildStockIdentityResolver({
      tallyProfile: INVESTOR_TALLY_DEFAULT,
      stockItems: [],
      ledgerOverrides: [
        ledger('AMC CHARGES-ZERODHA', 'Capital Account'),
        ledger('GST on Brokerage', 'Duties & Taxes'),
        ledger('Stt', 'Capital Account'),
        ledger('SHARE BROKERAGE', 'Capital Account'),
        ledger('Exchange and Other Charges', 'Capital Account'),
        ledger('DP Charges-Zerodha', 'Capital Account'),
        ledger('STCG ON WIPRO', 'STCG'),
        ledger('LTCG ON WIPRO', 'LTCG'),
        ledger('DIV WIPRO', 'Div on Shares'),
      ],
    });

    expect(resolver.resolve({ symbol: 'WIPRO' })).toMatchObject({
      investmentLedgerName: 'WIPRO-SH',
      stockItemName: 'WIPRO-SH',
      matchConfidence: 'generated',
      stockItemExistsInTally: false,
    });

    expect(resolver.resolve({ symbol: 'GST' })).toMatchObject({
      investmentLedgerName: 'GST-SH',
      stockItemName: 'GST-SH',
      matchConfidence: 'generated',
      stockItemExistsInTally: false,
    });

    expect(resolver.resolve({ symbol: 'STT' })).toMatchObject({
      investmentLedgerName: 'STT-SH',
      stockItemName: 'STT-SH',
      matchConfidence: 'generated',
      stockItemExistsInTally: false,
    });
  });

  it('ignores stale saved mappings that point a stock to dividend ledgers', () => {
    const resolver = buildStockIdentityResolver({
      tallyProfile: INVESTOR_TALLY_DEFAULT,
      stockItems: [],
      ledgerOverrides: [
        ledger('DIV WIPRO', 'Div on Shares'),
      ],
      securityMappings: [
        {
          id: 'mapping-wipro-dividend',
          user_id: 'user-001',
          mapping_key: 'SECURITY:ISIN:INE075A01022',
          security_id: 'ISIN:INE075A01022',
          broker_symbol: 'WIPRO',
          isin: 'INE075A01022',
          tally_ledger_name: 'DIV WIPRO',
          tally_ledger_group: 'Div on Shares',
          tally_stock_item_name: 'DIV WIPRO',
          base_unit: 'NOS',
          match_source: 'manual',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    expect(resolver.resolve({
      symbol: 'WIPRO',
      securityId: 'ISIN:INE075A01022',
      isin: 'INE075A01022',
    })).toMatchObject({
      investmentLedgerName: 'WIPRO-SH',
      stockItemName: 'WIPRO-SH',
      matchConfidence: 'generated',
      stockItemExistsInTally: false,
    });
  });

  it('does not reject valid stock names that begin with DIVI', () => {
    const resolver = buildStockIdentityResolver({
      tallyProfile: INVESTOR_TALLY_DEFAULT,
      stockItems: [],
      ledgerOverrides: [
        ledger('DIVISLAB-SH'),
      ],
    });

    expect(resolver.resolve({ symbol: 'DIVISLAB' })).toMatchObject({
      investmentLedgerName: 'DIVISLAB-SH',
      stockItemName: 'DIVISLAB-SH',
      matchConfidence: 'pattern',
    });
  });
});
