import { NextResponse } from 'next/server';
import { getLedgerRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { parseTallyCOA } from '@/lib/parsers/tally/coa-parser';
import type { LedgerOverrideInput } from '@/lib/db/ledger-repository';

/**
 * POST — upload a Tally XML file, parse ledger entries, and bulk-upsert.
 * Accepts multipart/form-data with a single file field named "file".
 */
export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const xml = await file.text();
        const coa = parseTallyCOA(xml);

        if (coa.ledgers.length === 0) {
            return NextResponse.json(
                { error: 'No ledger entries found in the uploaded XML' },
                { status: 400 },
            );
        }

        // Convert parsed ledgers to override inputs with slugified keys
        const inputs: LedgerOverrideInput[] = coa.ledgers.map((l) => ({
            ledger_key: slugify(l.name),
            name: l.name,
            parent_group: l.parent,
            is_custom: true,
        }));

        const repo = getLedgerRepository();
        const saved = await repo.bulkUpsertOverrides(userId, inputs);

        return NextResponse.json({
            imported: saved.length,
            ledgers: saved,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process Tally XML';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** Convert a ledger name to a URL-safe slug key. */
function slugify(name: string): string {
    return name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}
