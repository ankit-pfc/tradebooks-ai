import { NextRequest, NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { deriveFYLabel } from '@/lib/engine/accounting-policy';
import type { AppBatchStatus } from '@/lib/types';

const VALID_STATUSES: AppBatchStatus[] = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'needs_review',
];

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      companyName?: string;
      accountingMode?: string;
      periodFrom?: string;
      periodTo?: string;
      priorBatchId?: string;
    };

    const { companyName, accountingMode, periodFrom, periodTo, priorBatchId } = body;

    if (!companyName || !accountingMode) {
      return NextResponse.json(
        { error: 'Missing required fields: companyName, accountingMode' },
        { status: 400 },
      );
    }
    if (accountingMode !== 'investor' && accountingMode !== 'trader') {
      return NextResponse.json(
        { error: 'accountingMode must be "investor" or "trader"' },
        { status: 400 },
      );
    }

    const fyLabel = periodFrom && periodTo
      ? deriveFYLabel(periodFrom, periodTo) || undefined
      : undefined;

    const repo = getBatchRepository();
    const batch = await repo.createBatch({
      user_id: userId,
      company_name: companyName,
      accounting_mode: accountingMode as 'investor' | 'trader',
      period_from: periodFrom ?? '',
      period_to: periodTo ?? '',
      prior_batch_id: priorBatchId,
      fy_label: fyLabel,
    });

    return NextResponse.json({ batchId: batch.id, status: batch.status }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = getBatchRepository();
    const statusParam = request.nextUrl.searchParams.get('status');
    const allBatches = await repo.listBatches();

    if (statusParam && VALID_STATUSES.includes(statusParam as AppBatchStatus)) {
      const filtered = allBatches.filter((b) => b.status === statusParam);
      return NextResponse.json({ batches: filtered });
    }

    return NextResponse.json({ batches: allBatches });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load batches';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
