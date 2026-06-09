import { NextResponse } from 'next/server';
import { getStockMappingRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import type { TallySecurityMappingInput } from '@/lib/db/stock-mapping-repository';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mappings = await getStockMappingRepository().listMappings(userId);
    return NextResponse.json({ mappings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load security mappings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const inputs = normalizeInputs(body);
    if (inputs.length === 0) {
      return NextResponse.json(
        {
          error:
            'broker_symbol, tally_ledger_name, tally_ledger_group, and tally_stock_item_name are required',
        },
        { status: 400 },
      );
    }

    if (inputs.length === 1 && !isBulkPayload(body)) {
      const saved = await getStockMappingRepository().upsertMapping(userId, inputs[0]);
      return NextResponse.json(saved);
    }

    const saved = await getStockMappingRepository().bulkUpsertMappings(userId, inputs);
    return NextResponse.json({ mappings: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save security mapping';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isBulkPayload(body: unknown): boolean {
  return Boolean(
    body &&
      typeof body === 'object' &&
      Array.isArray((body as Record<string, unknown>).mappings),
  );
}

function normalizeInputs(body: unknown): TallySecurityMappingInput[] {
  if (isBulkPayload(body)) {
    const mappings = (body as { mappings: unknown[] }).mappings;
    return mappings
      .map((mapping) => normalizeInput(mapping))
      .filter((mapping): mapping is TallySecurityMappingInput => mapping !== null);
  }

  const single = normalizeInput(body);
  return single ? [single] : [];
}

function normalizeInput(body: unknown): TallySecurityMappingInput | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;

  const brokerSymbol = stringValue(raw.broker_symbol);
  const tallyLedgerName = stringValue(raw.tally_ledger_name);
  const tallyLedgerGroup = stringValue(raw.tally_ledger_group);
  const tallyStockItemName = stringValue(raw.tally_stock_item_name);

  if (!brokerSymbol || !tallyLedgerName || !tallyLedgerGroup || !tallyStockItemName) {
    return null;
  }

  return {
    security_id: stringValue(raw.security_id),
    broker_symbol: brokerSymbol,
    isin: stringValue(raw.isin),
    tally_ledger_name: tallyLedgerName,
    tally_ledger_group: tallyLedgerGroup,
    tally_stock_item_name: tallyStockItemName,
    base_unit: stringValue(raw.base_unit) || 'NOS',
    match_source: normalizeMatchSource(raw.match_source),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeMatchSource(value: unknown): TallySecurityMappingInput['match_source'] {
  if (
    value === 'manual' ||
    value === 'tally_alias' ||
    value === 'auto_exact' ||
    value === 'auto_pattern'
  ) {
    return value;
  }
  return 'manual';
}
