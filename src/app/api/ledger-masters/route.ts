import { NextResponse } from 'next/server';
import { getLedgerRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import * as L from '@/lib/constants/ledger-names';

// ---------------------------------------------------------------------------
// System defaults — derived from ledger-names.ts constants
// ---------------------------------------------------------------------------

interface LedgerEntry {
    key: string;
    name: string;
    group: string;
    source: 'system' | 'override' | 'custom';
}

const SYSTEM_LEDGERS: Array<{ key: string; name: string; group: string }> = [
    { key: 'BROKER', name: L.CA_BROKER.name, group: L.CA_BROKER.group },
    { key: 'BANK', name: L.BANK.name, group: L.BANK.group },
    { key: 'BROKERAGE', name: L.CA_BROKERAGE.name, group: L.CA_BROKERAGE.group },
    { key: 'STT', name: L.CA_STT.name, group: L.CA_STT.group },
    { key: 'EXCHANGE_CHARGES', name: L.CA_EXCHANGE_AND_OTHER.name, group: L.CA_EXCHANGE_AND_OTHER.group },
    { key: 'GST_ON_CHARGES', name: L.GST_ON_CHARGES.name, group: L.GST_ON_CHARGES.group },
    { key: 'STAMP_DUTY', name: L.STAMP_DUTY.name, group: L.STAMP_DUTY.group },
    { key: 'DP_CHARGES', name: L.CA_DP_CHARGES.name, group: L.CA_DP_CHARGES.group },
    { key: 'DEMAT_CHARGES', name: L.CA_DEMAT_CHARGES.name, group: L.CA_DEMAT_CHARGES.group },
    { key: 'AMC_CHARGES', name: L.CA_AMC_CHARGES.name, group: L.CA_AMC_CHARGES.group },
    { key: 'STCG_PROFIT', name: L.STCG_PROFIT.name, group: L.STCG_PROFIT.group },
    { key: 'LTCG_PROFIT', name: L.LTCG_PROFIT.name, group: L.LTCG_PROFIT.group },
    { key: 'STCG_LOSS', name: L.STCG_LOSS.name, group: L.STCG_LOSS.group },
    { key: 'LTCG_LOSS', name: L.LTCG_LOSS.name, group: L.LTCG_LOSS.group },
    { key: 'SPECULATIVE_PROFIT', name: L.CA_SPECULATION_GAIN.name, group: L.CA_SPECULATION_GAIN.group },
    { key: 'SPECULATIVE_LOSS', name: L.CA_SPECULATION_LOSS.name, group: L.CA_SPECULATION_LOSS.group },
    { key: 'DIVIDEND_INCOME', name: L.CA_DIVIDEND_INCOME.name, group: L.CA_DIVIDEND_INCOME.group },
    { key: 'TDS_ON_DIVIDEND', name: L.TDS_ON_DIVIDEND.name, group: L.TDS_ON_DIVIDEND.group },
    { key: 'TDS_ON_SECURITIES', name: L.TDS_ON_SECURITIES.name, group: L.TDS_ON_SECURITIES.group },
    { key: 'OFF_MARKET_SUSPENSE', name: L.OFF_MARKET_SUSPENSE.name, group: L.OFF_MARKET_SUSPENSE.group },
];

// ---------------------------------------------------------------------------
// GET — merged system defaults + user overrides
// ---------------------------------------------------------------------------

export async function GET() {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const repo = getLedgerRepository();
        const overrides = await repo.listOverrides(userId);
        const overrideMap = new Map(overrides.map((o) => [o.ledger_key, o]));

        const ledgers: LedgerEntry[] = SYSTEM_LEDGERS.map((sys) => {
            const override = overrideMap.get(sys.key);
            if (override) {
                overrideMap.delete(sys.key);
                return {
                    key: sys.key,
                    name: override.name,
                    group: override.parent_group,
                    source: 'override' as const,
                };
            }
            return { ...sys, source: 'system' as const };
        });

        // Append custom ledgers (not overriding any system key)
        for (const [, override] of overrideMap) {
            ledgers.push({
                key: override.ledger_key,
                name: override.name,
                group: override.parent_group,
                source: 'custom' as const,
            });
        }

        return NextResponse.json({ ledgers });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load ledger masters';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// POST — upsert a single ledger override
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { ledger_key, name, parent_group } = body;

        if (!ledger_key || !name || !parent_group) {
            return NextResponse.json(
                { error: 'ledger_key, name, and parent_group are required' },
                { status: 400 },
            );
        }

        const isSystem = SYSTEM_LEDGERS.some((s) => s.key === ledger_key);

        const repo = getLedgerRepository();
        const saved = await repo.upsertOverride(userId, {
            ledger_key,
            name,
            parent_group,
            is_custom: !isSystem,
        });

        return NextResponse.json(saved);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save ledger override';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// DELETE — remove an override, restoring the system default
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const ledgerKey = searchParams.get('ledger_key');

        if (!ledgerKey) {
            return NextResponse.json({ error: 'ledger_key query param required' }, { status: 400 });
        }

        const repo = getLedgerRepository();
        await repo.deleteOverride(userId, ledgerKey);

        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete ledger override';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
