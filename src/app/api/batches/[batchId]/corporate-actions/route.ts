import { NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import type { CorporateActionInput } from '@/lib/parsers/zerodha/types';

/**
 * User-declared corporate actions (bonus, split, rights, merger/demerger) for
 * a batch. See `src/lib/parsers/zerodha/types.ts:CorporateActionInput` for
 * the canonical shape. These are consumed by the processing pipeline when
 * the batch is (re-)processed.
 *
 * POST replaces the full list. There is no append — callers should send the
 * full set of actions they want associated with the batch. This keeps the
 * contract symmetric with GET and avoids partial-update race conditions.
 */

const VALID_ACTION_TYPES = ['BONUS', 'STOCK_SPLIT', 'RIGHTS_ISSUE', 'MERGER_DEMERGER'] as const;
type ValidActionType = (typeof VALID_ACTION_TYPES)[number];

// Narrow an unknown body into CorporateActionInput[]. Returns [] and throws
// via the caller when any field is malformed — keeps the error local.
function validateCorporateActions(value: unknown): CorporateActionInput[] {
  if (!Array.isArray(value)) {
    throw new Error('corporate_actions must be an array');
  }
  return value.map((raw, i) => validateOne(raw, i));
}

function validateOne(raw: unknown, i: number): CorporateActionInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`corporate_actions[${i}] must be an object`);
  }
  const r = raw as Record<string, unknown>;

  const actionType = r.action_type;
  if (typeof actionType !== 'string' || !VALID_ACTION_TYPES.includes(actionType as ValidActionType)) {
    throw new Error(
      `corporate_actions[${i}].action_type must be one of ${VALID_ACTION_TYPES.join(', ')}`,
    );
  }

  const securityId = r.security_id;
  if (typeof securityId !== 'string' || securityId.trim().length === 0) {
    throw new Error(`corporate_actions[${i}].security_id is required`);
  }

  const actionDate = r.action_date;
  if (typeof actionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(actionDate)) {
    throw new Error(`corporate_actions[${i}].action_date must be YYYY-MM-DD`);
  }

  const ratioNumerator = r.ratio_numerator;
  const ratioDenominator = r.ratio_denominator;
  if (
    (typeof ratioNumerator !== 'string' && typeof ratioNumerator !== 'number') ||
    (typeof ratioDenominator !== 'string' && typeof ratioDenominator !== 'number')
  ) {
    throw new Error(
      `corporate_actions[${i}] must have numeric ratio_numerator and ratio_denominator`,
    );
  }

  // Reject zero denominator — would divide by zero in engine.
  if (Number(ratioDenominator) === 0) {
    throw new Error(`corporate_actions[${i}].ratio_denominator cannot be zero`);
  }

  const action: CorporateActionInput = {
    action_type: actionType as ValidActionType,
    security_id: securityId.trim(),
    action_date: actionDate,
    ratio_numerator: String(ratioNumerator),
    ratio_denominator: String(ratioDenominator),
  };

  if (typeof r.new_security_id === 'string' && r.new_security_id.trim().length > 0) {
    action.new_security_id = r.new_security_id.trim();
  }
  if (typeof r.cost_per_share === 'string' || typeof r.cost_per_share === 'number') {
    action.cost_per_share = String(r.cost_per_share);
  }
  if (typeof r.notes === 'string' && r.notes.length > 0) {
    action.notes = r.notes;
  }

  // MERGER_DEMERGER requires new_security_id to be meaningful; rights issue
  // requires a cost_per_share. These are pipeline-level invariants — surface
  // them here so the user sees a clear validation error instead of a runtime
  // explosion later.
  if (action.action_type === 'MERGER_DEMERGER' && !action.new_security_id) {
    throw new Error(
      `corporate_actions[${i}] MERGER_DEMERGER requires new_security_id`,
    );
  }
  if (action.action_type === 'RIGHTS_ISSUE' && !action.cost_per_share) {
    throw new Error(
      `corporate_actions[${i}] RIGHTS_ISSUE requires cost_per_share`,
    );
  }

  return action;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId } = await params;
    const repo = getBatchRepository();
    const batch = await repo.getBatch(batchId);
    if (!batch) {
      return NextResponse.json(
        { error: `Batch not found: ${batchId}` },
        { status: 404 },
      );
    }
    if (batch.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const actions = await repo.getCorporateActions(batchId);
    return NextResponse.json({ batchId, corporate_actions: actions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load corporate actions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId } = await params;
    const repo = getBatchRepository();
    const batch = await repo.getBatch(batchId);
    if (!batch) {
      return NextResponse.json(
        { error: `Batch not found: ${batchId}` },
        { status: 404 },
      );
    }
    if (batch.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const payload = (body as { corporate_actions?: unknown })?.corporate_actions;
    let actions: CorporateActionInput[];
    try {
      actions = validateCorporateActions(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid corporate actions';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    await repo.saveCorporateActions(batchId, actions);
    return NextResponse.json({ batchId, corporate_actions: actions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save corporate actions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
