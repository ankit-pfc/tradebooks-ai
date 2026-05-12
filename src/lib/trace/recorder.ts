import { createHash } from 'node:crypto';
import {
  TRACE_SCHEMA_VERSION,
  type TraceBundle,
  type TraceFile,
  type TraceLineage,
  type TraceStage,
} from './types';

/**
 * Returns true when the pipeline should produce a trace bundle for this run.
 * Pre-GA-only — gate is removed when feature is retired.
 */
export function isTraceEnabled(): boolean {
  return process.env.TRACE_PIPELINE === '1' || process.env.TRACE_PIPELINE === 'true';
}

/**
 * Collects stage-by-stage snapshots from a single pipeline run.
 *
 * The recorder is intentionally side-effect-free: it accumulates data in
 * memory and exposes `toBundle()` for the caller to persist. All methods are
 * cheap; a no-op recorder (see `nullRecorder`) is used when tracing is off
 * so call sites in the pipeline don't need conditionals.
 */
export class TraceRecorder {
  private readonly batchId: string;
  private readonly inputs: TraceBundle['inputs'];
  private readonly files: TraceFile[] = [];
  private readonly stages: TraceStage[] = [];
  private readonly lineage: TraceLineage = {
    eventsByFile: {},
    vouchersByEvent: {},
    voucherByExternalRef: {},
    voucherByLedger: {},
    voucherByStockItem: {},
  };
  private readonly artifacts: TraceBundle['artifacts'] = {};
  private outputs?: TraceBundle['outputs'];
  private error?: TraceBundle['error'];
  private readonly capturedAt = new Date().toISOString();

  constructor(batchId: string, inputs: TraceBundle['inputs']) {
    this.batchId = batchId;
    this.inputs = inputs;
  }

  /** Record one named pipeline stage with its inputs/outputs and timing. */
  stage(
    name: string,
    fn: () => Record<string, unknown>,
    opts?: { diagnostics?: string[] },
  ): void {
    const startedAt = new Date();
    const start = performance.now();
    const data = fn();
    const finishedAt = new Date();
    const durationMs = Math.round(performance.now() - start);
    this.stages.push({
      name,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      summary: extractSummary(data),
      diagnostics: opts?.diagnostics,
      data,
    });
  }

  /** Async variant of `stage()` — used when the stage data is fetched. */
  async stageAsync(
    name: string,
    fn: () => Promise<Record<string, unknown>>,
    opts?: { diagnostics?: string[] },
  ): Promise<void> {
    const startedAt = new Date();
    const start = performance.now();
    const data = await fn();
    const finishedAt = new Date();
    const durationMs = Math.round(performance.now() - start);
    this.stages.push({
      name,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      summary: extractSummary(data),
      diagnostics: opts?.diagnostics,
      data,
    });
  }

  attachFile(meta: {
    fileId: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    detectedType: string;
  }): void {
    this.files.push({
      fileId: meta.fileId,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      sizeBytes: meta.buffer.length,
      sha256: createHash('sha256').update(meta.buffer).digest('hex'),
      detectedType: meta.detectedType,
    });
  }

  /**
   * Index canonical events for reverse lookup.
   * Each event is grouped under its source file so a "which file?" query
   * resolves in O(1) at view time.
   */
  indexEvents(events: Array<{ event_id: string; source_file_id?: string | null }>): void {
    for (const event of events) {
      const fid = event.source_file_id ?? 'unknown';
      (this.lineage.eventsByFile[fid] ??= []).push(event.event_id);
    }
  }

  /**
   * Index vouchers for reverse lookup. Maps:
   *   external_reference -> voucher_draft_id (Tally VOUCHERNUMBER → draft)
   *   event_id           -> voucher_draft_id (event → posting)
   *   ledger_name        -> voucher_draft_id (ledger → posting)
   *   stock_item         -> voucher_draft_id (stock master → posting)
   */
  indexVouchers(
    vouchers: Array<{
      voucher_draft_id: string;
      external_reference?: string | null;
      source_event_ids?: string[];
      lines?: Array<{ ledger_name: string; stock_item_name?: string | null }>;
    }>,
  ): void {
    for (const v of vouchers) {
      if (v.external_reference) {
        this.lineage.voucherByExternalRef[v.external_reference] = v.voucher_draft_id;
      }
      for (const eventId of v.source_event_ids ?? []) {
        (this.lineage.vouchersByEvent[eventId] ??= []).push(v.voucher_draft_id);
      }
      for (const line of v.lines ?? []) {
        (this.lineage.voucherByLedger[line.ledger_name] ??= []).push(v.voucher_draft_id);
        if (line.stock_item_name) {
          (this.lineage.voucherByStockItem[line.stock_item_name] ??= []).push(
            v.voucher_draft_id,
          );
        }
      }
    }
  }

  attachArtifact<K extends keyof TraceBundle['artifacts']>(
    key: K,
    value: TraceBundle['artifacts'][K],
  ): void {
    this.artifacts[key] = value;
  }

  recordOutputs(outputs: Record<string, unknown>): void {
    this.outputs = outputs;
  }

  recordError(err: unknown): void {
    if (err instanceof Error) {
      this.error = {
        message: err.message,
        code: (err as { code?: string }).code,
        stack: err.stack,
      };
    } else {
      this.error = { message: String(err) };
    }
  }

  toBundle(): TraceBundle {
    return {
      schemaVersion: TRACE_SCHEMA_VERSION,
      batchId: this.batchId,
      capturedAt: this.capturedAt,
      inputs: this.inputs,
      files: this.files,
      stages: this.stages,
      outputs: this.outputs,
      error: this.error,
      lineage: this.lineage,
      artifacts: this.artifacts,
    };
  }
}

/**
 * Extract a small "summary" view of stage data — counts, ids, totals — so
 * the viewer can render a stage list without rehydrating the full payload.
 */
function extractSummary(data: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      summary[`${key}_count`] = value.length;
    } else if (typeof value === 'object' && value !== null) {
      summary[`${key}_keys`] = Object.keys(value).length;
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      summary[key] = value;
    }
  }
  return summary;
}
