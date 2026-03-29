import { NextRequest, NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyName = request.nextUrl.searchParams.get('company_name');
    if (!companyName) {
      return NextResponse.json(
        { error: 'company_name query parameter is required' },
        { status: 400 },
      );
    }

    const repo = getBatchRepository();
    const batches = await repo.listPriorBatches(userId, companyName);

    return NextResponse.json({ batches });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list prior batches';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
