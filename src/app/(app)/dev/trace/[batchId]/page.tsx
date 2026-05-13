import { notFound } from 'next/navigation';
import { isTraceEnabled } from '@/lib/trace';
import { TraceViewer } from './trace-viewer';

/**
 * Pre-GA-only pipeline trace viewer.
 *
 * Reverse-lookup a Tally voucher / ledger / stock-item name back to the
 * canonical events and source rows that produced it. Entire route 404s when
 * `TRACE_PIPELINE` is unset, so it's safe to leave deployed in prod with
 * the flag off until the feature is retired and the directory is deleted.
 */
export default async function TraceViewerPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  if (!isTraceEnabled()) notFound();
  const { batchId } = await params;
  return <TraceViewer batchId={batchId} />;
}
