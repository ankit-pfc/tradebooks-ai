'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileSearch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { TraceBundle } from '@/lib/trace/types';

interface LookupHit {
  kind: 'voucher' | 'event' | 'file';
  id: string;
  detail: Record<string, unknown>;
}

export function TraceViewer({ batchId }: { batchId: string }) {
  const [bundle, setBundle] = useState<TraceBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dev/trace/${batchId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return (await res.json()) as TraceBundle;
      })
      .then((data) => {
        if (!cancelled) {
          setBundle(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const hits = useMemo<LookupHit[]>(() => {
    if (!bundle || !query.trim()) return [];
    const q = query.trim();
    const out: LookupHit[] = [];

    // voucher external_reference (Tally VOUCHERNUMBER) → draft id
    const refMatch = bundle.lineage.voucherByExternalRef[q];
    if (refMatch) {
      out.push({ kind: 'voucher', id: refMatch, detail: { matchedBy: 'external_reference' } });
    }
    // Substring match across all external refs
    for (const [ref, draftId] of Object.entries(bundle.lineage.voucherByExternalRef)) {
      if (ref !== q && ref.toLowerCase().includes(q.toLowerCase())) {
        out.push({ kind: 'voucher', id: draftId, detail: { matchedBy: `external_reference~${ref}` } });
      }
    }
    // Ledger name lookup
    for (const [ledger, draftIds] of Object.entries(bundle.lineage.voucherByLedger)) {
      if (ledger.toLowerCase().includes(q.toLowerCase())) {
        for (const id of draftIds) {
          out.push({ kind: 'voucher', id, detail: { matchedBy: `ledger=${ledger}` } });
        }
      }
    }
    // Stock item lookup
    for (const [stock, draftIds] of Object.entries(bundle.lineage.voucherByStockItem)) {
      if (stock.toLowerCase().includes(q.toLowerCase())) {
        for (const id of draftIds) {
          out.push({ kind: 'voucher', id, detail: { matchedBy: `stock=${stock}` } });
        }
      }
    }
    // File name lookup
    for (const f of bundle.files) {
      if (
        f.fileName.toLowerCase().includes(q.toLowerCase()) ||
        f.fileId === q ||
        f.sha256 === q
      ) {
        out.push({ kind: 'file', id: f.fileId, detail: { fileName: f.fileName, sha256: f.sha256 } });
      }
    }
    return out;
  }, [bundle, query]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return <div className="p-8 text-sm text-ink-2">Loading trace…</div>;
  }
  if (error) {
    return (
      <div className="p-8 max-w-3xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Trace unavailable</h1>
        <p className="text-sm text-neg">{error}</p>
        <p className="text-xs text-ink-3 mt-4">
          Traces are written only when <code className="mono-data bg-surface-2 px-1 rounded-sm">TRACE_PIPELINE=1</code> is set at processing time.
          Re-process the batch with the flag on and reload.
        </p>
      </div>
    );
  }
  if (!bundle) return null;

  return (
    <div className="px-6 py-6 max-w-6xl space-y-6">
      <header>
        {/* PRE-GA warning banner */}
        <div className="flex items-center gap-2 text-xs text-warn bg-warn/10 border border-warn/30 px-3 py-1.5 rounded-md w-fit mb-4">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">PRE-GA DEBUG</span>
          <span className="text-ink-3">·</span>
          <span>This view is removed at code freeze.</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Pipeline trace</h1>
        <p className="text-sm text-ink-2 mt-1">
          Batch{' '}
          <code className="mono-data text-xs bg-surface-2 px-1.5 py-0.5 rounded-sm">{bundle.batchId}</code>
          {' '}·{' '}
          <span className="mono-data">{new Date(bundle.capturedAt).toLocaleString('en-IN')}</span>
        </p>
      </header>

      {/* Reverse lookup */}
      <Card size="sm">
        <CardHeader className="border-b border-hairline">
          <CardTitle className="text-[15px]">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-ink-2" />
              Reverse lookup
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste a Tally voucher number, ledger name, stock item, or file name"
            className="font-mono"
          />
          {hits.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-ink-3">
                <span className="mono-data">{hits.length}</span> hit(s)
              </p>
              {hits.slice(0, 50).map((h, i) => (
                <HitRow key={`${h.kind}-${h.id}-${i}`} hit={h} bundle={bundle} />
              ))}
            </div>
          )}
          {query.trim() && hits.length === 0 && (
            <p className="text-xs text-ink-3">No match for &ldquo;{query}&rdquo;.</p>
          )}
        </CardContent>
      </Card>

      {/* Inputs */}
      <Card size="sm">
        <CardHeader className="border-b border-hairline">
          <CardTitle className="text-[15px]">Inputs</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <Kv data={bundle.inputs as Record<string, unknown>} />
        </CardContent>
      </Card>

      {/* Files */}
      <Card size="sm">
        <CardHeader className="border-b border-hairline">
          <CardTitle className="text-[15px]">
            Files{' '}
            <span className="font-normal text-ink-3 mono-data ml-1">({bundle.files.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-0">
          <table className="w-full text-xs">
            <thead className="bg-surface-2">
              <tr>
                <th className="text-left px-6 py-2 text-xs font-medium uppercase tracking-wide text-ink-2">Name</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-2">Detected</th>
                <th className="text-right px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-2">Size</th>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-2 pr-6">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {bundle.files.map((f) => (
                <tr key={f.fileId} className="border-t border-hairline hover:bg-surface-2 transition-colors">
                  <td className="px-6 py-2 mono-data">{f.fileName}</td>
                  <td className="px-3 py-2 text-ink-2">{f.detectedType}</td>
                  <td className="px-3 py-2 text-right mono-data text-ink-2">{f.sizeBytes.toLocaleString('en-IN')} B</td>
                  <td className="px-3 py-2 pr-6 mono-data text-[10px] text-ink-3">{f.sha256.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Stages */}
      <Card size="sm">
        <CardHeader className="border-b border-hairline">
          <CardTitle className="text-[15px]">
            Stages{' '}
            <span className="font-normal text-ink-3 mono-data ml-1">({bundle.stages.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">
          {bundle.stages.map((stage, i) => {
            const key = `stage-${i}`;
            const open = expanded.has(key);
            return (
              <div key={key} className="border border-hairline rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-left text-sm hover:bg-surface-2 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <span className="mono-data text-ink-3 text-xs">{i + 1}.</span>
                    {open
                      ? <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
                      : <ChevronRight className="h-3.5 w-3.5 text-ink-3" />}
                    {stage.name}
                  </span>
                  <span className="mono-data text-xs text-ink-3">{stage.durationMs}ms</span>
                </button>
                {open && (
                  <div className="px-4 py-3 border-t border-hairline bg-surface-2 space-y-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3 mb-1.5">Summary</p>
                      <Kv data={stage.summary} />
                    </div>
                    {stage.diagnostics && stage.diagnostics.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3 mb-1.5">Diagnostics</p>
                        <ul className="text-xs list-disc pl-5 space-y-0.5 text-ink-2">
                          {stage.diagnostics.map((d, j) => (
                            <li key={j}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {stage.data && (
                      <details>
                        <summary className="text-xs cursor-pointer text-cyan hover:underline">
                          Show full stage data
                        </summary>
                        <pre className="mono-data text-[10px] mt-2 max-h-96 overflow-auto bg-card p-3 border border-hairline rounded-md">
                          {JSON.stringify(stage.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Outputs */}
      {bundle.outputs && (
        <Card size="sm">
          <CardHeader className="border-b border-hairline">
            <CardTitle className="text-[15px]">Outputs</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Kv data={bundle.outputs} />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {bundle.error && (
        <Card size="sm" className="border-neg/40 bg-neg/5">
          <CardHeader className="border-b border-neg/20">
            <CardTitle className="text-[15px] text-neg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            <p className="mono-data text-xs text-neg">{bundle.error.message}</p>
            {bundle.error.stack && (
              <pre className="mono-data text-[10px] mt-2 overflow-auto max-h-64 text-ink-2">{bundle.error.stack}</pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HitRow({ hit, bundle }: { hit: LookupHit; bundle: TraceBundle }) {
  const voucher =
    hit.kind === 'voucher'
      ? (bundle.artifacts.vouchers as Array<Record<string, unknown>> | undefined)?.find(
          (v) => (v as { voucher_draft_id: string }).voucher_draft_id === hit.id,
        )
      : null;
  const sourceEventIds = voucher
    ? ((voucher as { source_event_ids?: string[] }).source_event_ids ?? [])
    : [];
  const sourceEvents = (bundle.artifacts.events as Array<Record<string, unknown>> | undefined)
    ?.filter((e) => sourceEventIds.includes((e as { event_id: string }).event_id))
    ?? [];

  return (
    <details className="border border-hairline rounded-md text-xs overflow-hidden">
      <summary className="px-3 py-2 cursor-pointer hover:bg-surface-2 transition-colors list-none flex items-center gap-2">
        <ChevronRight className="h-3 w-3 text-ink-3 shrink-0 [[open]>summary>&]:rotate-90 transition-transform" />
        <span className="mono-data text-ink">{hit.kind}:{hit.id.slice(0, 12)}…</span>
        <span className="text-ink-3 ml-1">
          {Object.entries(hit.detail).map(([k, v]) => `${k}=${String(v)}`).join(' · ')}
        </span>
      </summary>
      <div className="p-3 border-t border-hairline bg-surface-2 space-y-3">
        {voucher && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3 mb-1.5">Voucher</p>
            <pre className="mono-data text-[10px] bg-card p-2 border border-hairline rounded-md max-h-64 overflow-auto">
              {JSON.stringify(voucher, null, 2)}
            </pre>
          </div>
        )}
        {sourceEvents.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3 mb-1.5">
              Source events (<span className="mono-data">{sourceEvents.length}</span>)
            </p>
            <pre className="mono-data text-[10px] bg-card p-2 border border-hairline rounded-md max-h-64 overflow-auto">
              {JSON.stringify(sourceEvents, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}

function Kv({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3 whitespace-nowrap">{k}</dt>
          <dd className="mono-data break-all text-ink">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
