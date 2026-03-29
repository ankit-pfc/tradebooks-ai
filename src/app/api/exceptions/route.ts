import { NextRequest, NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import type { AppExceptionSeverity } from '@/lib/types';

const VALID_SEVERITIES: AppExceptionSeverity[] = ['error', 'warning', 'info'];

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = getBatchRepository();
    const severityParam = request.nextUrl.searchParams.get('severity');
    const allExceptions = await repo.listExceptions();

    const batchIdParam = request.nextUrl.searchParams.get('batch_id');

    let filtered = allExceptions;

    if (batchIdParam) {
      filtered = filtered.filter((e) => e.batch_id === batchIdParam);
    }

    if (
      severityParam &&
      VALID_SEVERITIES.includes(severityParam as AppExceptionSeverity)
    ) {
      filtered = filtered.filter((e) => e.severity === severityParam);
    }

    return NextResponse.json({ exceptions: filtered });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load exceptions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
