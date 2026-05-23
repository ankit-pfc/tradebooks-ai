import { NextResponse } from 'next/server';
import { getLedgerRepository, getStockItemRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { matchCOAToProfile, parseTallyCOA } from '@/lib/parsers/tally/coa-parser';
import { SYSTEM_LEDGER_NAME_TO_KEY } from '@/lib/constants/ledger-names';
import type { LedgerOverrideInput } from '@/lib/db/ledger-repository';
import { MAX_FILE_SIZE } from '@/lib/upload-constants';
import { decodeXmlBuffer } from './decode-xml-buffer';
import { EventType } from '@/lib/types/events';

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

        if (coa.ledgers.length === 0 && coa.stockItems.length === 0) {
            return NextResponse.json(
                { error: 'No ledger or stock item entries found in the uploaded XML' },
                { status: 400 },
            );
        }

        // Convert parsed ledgers to override inputs.
        // Match against system ledger names first so imports can override built-ins.
        const inputMap = new Map<string, LedgerOverrideInput>();
        const putInput = (input: LedgerOverrideInput) => {
            inputMap.set(input.ledger_key, input);
        };

        for (const l of coa.ledgers) {
            const systemKey = SYSTEM_LEDGER_NAME_TO_KEY.get(l.name.trim().toUpperCase());
            putInput({
                ledger_key: systemKey ?? slugify(l.name),
                name: l.name,
                parent_group: l.parent,
                is_custom: !systemKey,
            });
        }

        const coaMatch = matchCOAToProfile(coa);
        addProfileMatchInputs(coaMatch.profile, putInput);

        const repo = getLedgerRepository();
        const saved = await repo.bulkUpsertOverrides(userId, Array.from(inputMap.values()));

        const stockRepo = getStockItemRepository();
        const savedStockItems = await stockRepo.bulkUpsertStockItems(
            userId,
            coa.stockItems.map((item) => ({
                name: item.name,
                base_unit: item.baseUnit,
            })),
        );

        return NextResponse.json({
            imported: saved.length,
            stockItemsImported: savedStockItems.length,
            profileMatchConfidence: coaMatch.confidence,
            ledgers: saved,
            stockItems: savedStockItems,
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

function addProfileMatchInputs(
    profile: ReturnType<typeof matchCOAToProfile>['profile'],
    putInput: (input: LedgerOverrideInput) => void,
): void {
    if (profile.broker) {
        putInput({
            ledger_key: 'BROKER',
            name: profile.broker.name,
            parent_group: profile.broker.group,
            is_custom: false,
        });
    }
    if (profile.bank) {
        putInput({
            ledger_key: 'BANK',
            name: profile.bank.name,
            parent_group: profile.bank.group,
            is_custom: false,
        });
    }
    if (profile.investment) {
        putInput({
            ledger_key: 'INVESTMENT',
            name: profile.investment.template,
            parent_group: profile.investment.group,
            is_custom: false,
        });
    }

    const templateInputs: Array<[string, typeof profile.stcg]> = [
        ['STCG_PROFIT', profile.stcg],
        ['LTCG_PROFIT', profile.ltcg],
        ['STCG_LOSS', profile.stcl],
        ['LTCG_LOSS', profile.ltcl],
        ['DIVIDEND_INCOME', profile.dividend],
    ];
    for (const [ledger_key, template] of templateInputs) {
        if (!template) continue;
        putInput({
            ledger_key,
            name: template.template,
            parent_group: template.group,
            is_custom: false,
        });
    }

    if (profile.tdsOnDividend) {
        putInput({
            ledger_key: 'TDS_ON_DIVIDEND',
            name: profile.tdsOnDividend.name,
            parent_group: profile.tdsOnDividend.group,
            is_custom: false,
        });
    }
    if (profile.tdsOnSecurities) {
        putInput({
            ledger_key: 'TDS_ON_SECURITIES',
            name: profile.tdsOnSecurities.name,
            parent_group: profile.tdsOnSecurities.group,
            is_custom: false,
        });
    }

    const chargeKeyByEventType = new Map<EventType, string>([
        [EventType.BROKERAGE, 'BROKERAGE'],
        [EventType.STT, 'STT'],
        [EventType.EXCHANGE_CHARGE, 'EXCHANGE_CHARGES'],
        [EventType.SEBI_CHARGE, 'EXCHANGE_CHARGES'],
        [EventType.GST_ON_CHARGES, 'GST_ON_CHARGES'],
        [EventType.STAMP_DUTY, 'STAMP_DUTY'],
        [EventType.DP_CHARGE, 'DP_CHARGES'],
    ]);

    for (const charge of profile.chargeConsolidation ?? []) {
        const key = charge.eventTypes
            .map((eventType) => chargeKeyByEventType.get(eventType))
            .find((value): value is string => Boolean(value));
        if (!key) continue;
        putInput({
            ledger_key: key,
            name: charge.ledgerName,
            parent_group: charge.groupName,
            is_custom: false,
        });
    }
}
