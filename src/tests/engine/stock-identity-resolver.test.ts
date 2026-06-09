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
});
