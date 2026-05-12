import { isTraceEnabled, TraceRecorder } from './recorder';
import { persistTrace } from './writer';
import type { TraceBundle } from './types';

/**
 * Create a recorder for an API route. Returns `undefined` when tracing is
 * disabled so call sites can pass it directly into `runProcessingPipeline`.
 */
export function maybeCreateRecorder(
  batchId: string,
  inputs: TraceBundle['inputs'],
): TraceRecorder | undefined {
  if (!isTraceEnabled()) return undefined;
  return new TraceRecorder(batchId, inputs);
}

/**
 * Best-effort persist + log. Never throws — a failed trace write must not
 * affect the user-facing processing response.
 */
export async function finalizeTrace(
  recorder: TraceRecorder | undefined,
  err?: unknown,
): Promise<void> {
  if (!recorder) return;
  if (err !== undefined) recorder.recordError(err);
  const result = await persistTrace(recorder.toBundle());
  if (!result.ok) {
    console.warn(`[trace] persist failed for ${result.path}: ${result.error}`);
  } else {
    console.log(`[trace] persisted ${result.path}`);
  }
}
