import { NextResponse } from 'next/server';
import { getLedgerRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { parseTallyCOA } from '@/lib/parsers/tally/coa-parser';
import { SYSTEM_LEDGER_NAME_TO_KEY } from '@/lib/constants/ledger-names';
import type { LedgerOverrideInput } from '@/lib/db/ledger-repository';
import { MAX_FILE_SIZE } from '@/lib/upload-constants';
import { decodeXmlBuffer } from './decode-xml-buffer';

/**
 * POST — upload a Tally XML file, parse ledger entries, and bulk-upsert.
 * Accepts the raw file as the request body (any content-type). The body is
 * decoded BOM-aware so UTF-16 LE/BE Tally exports parse correctly.
 */
export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const buf = await readRequestBody(request);
        if (buf.byteLength === 0) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        if (buf.byteLength > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'File too large' }, { status: 413 });
        }

        const xml = decodeXmlBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
        const coa = parseTallyCOA(xml);

        if (coa.ledgers.length === 0) {
            return NextResponse.json(
                { error: 'No ledger entries found in the uploaded XML' },
                { status: 400 },
            );
        }

        // Convert parsed ledgers to override inputs.
        // Match against system ledger names first so imports can override built-ins.
        const inputs: LedgerOverrideInput[] = coa.ledgers.map((l) => {
            const systemKey = SYSTEM_LEDGER_NAME_TO_KEY.get(l.name.trim().toUpperCase());
            return {
                ledger_key: systemKey ?? slugify(l.name),
                name: l.name,
                parent_group: l.parent,
                is_custom: !systemKey,
            };
        });

        const repo = getLedgerRepository();
        const saved = await repo.bulkUpsertOverrides(userId, inputs);

        return NextResponse.json({
            imported: saved.length,
            ledgers: saved,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process Tally XML';
        const status = message === 'File too large' ? 413 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

/**
 * Read the full request body into a single Uint8Array by streaming chunks.
 * The default `request.arrayBuffer()` works too, but explicit streaming
 * avoids surprises if the runtime layers a buffered-body cap on top of it.
 * Body-size enforcement at the Next.js layer is configured via
 * `middlewareClientMaxBodySize` in next.config.ts.
 */
async function readRequestBody(request: Request): Promise<Uint8Array> {
    if (!request.body) return new Uint8Array(0);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                chunks.push(value);
                total += value.byteLength;
                if (total > MAX_FILE_SIZE) {
                    reader.cancel();
                    throw new Error('File too large');
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
    }
    return out;
}

/** Convert a ledger name to a URL-safe slug key. */
function slugify(name: string): string {
    return name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}
