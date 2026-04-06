import { NextResponse } from 'next/server';
import { getLedgerRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { SYSTEM_LEDGERS, SYSTEM_LEDGER_KEYS } from '@/lib/constants/ledger-names';

// ---------------------------------------------------------------------------
// System defaults — derived from ledger-names.ts constants
// ---------------------------------------------------------------------------

interface LedgerEntry {
    key: string;
    name: string;
    group: string;
    source: 'system' | 'override' | 'custom';
}

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

        const isSystem = SYSTEM_LEDGER_KEYS.has(ledger_key);

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
