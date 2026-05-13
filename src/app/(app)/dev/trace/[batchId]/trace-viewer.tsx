'use client';

import { useEffect, useMemo, useState } from 'react';
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
    return <div className="p-8 text-sm text-gray-500">Loading trace…</div>;
  }
  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-2">Trace unavailable</h1>
        <p className="text-sm text-red-600">{error}</p>
        <p className="text-xs text-gray-500 mt-4">
          Traces are written only when <code>TRACE_PIPELINE=1</code> is set at processing time.
          Re-process the batch with the flag on and reload.
        </p>
      </div>
    );
  }
  if (!bundle) return null;

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md w-fit mb-3">
          <span className="font-semibold">PRE-GA DEBUG</span>
          <span>·</span>
          <span>This view is removed at code freeze.</span>
        </div>
        <h1 className="text-2xl font-semibold">Pipeline trace</h1>
        <p className="text-sm text-gray-500 mt-1">
          Batch <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{bundle.batchId}</code> ·
          captured {new Date(bundle.capturedAt).toLocaleString()}
        </p>
      </header>

      <section className="border rounded-md p-4">
        <h2 className="text-sm font-semibold mb-2">Reverse lookup</h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Paste a Tally voucher number, ledger name, stock item, or file name"
          className="w-full px-3 py-2 text-sm border rounded-md font-mono"
        />
        {hits.length > 0 && (
          <div className="mt-3 space-y-1 text-sm">
            <p className="text-xs text-gray-500">{hits.length} hit(s)</p>
            {hits.slice(0, 50).map((h, i) => (
              <HitRow key={`${h.kind}-${h.id}-${i}`} hit={h} bundle={bundle} />
            ))}
          </div>
        )}
        {query.trim() && hits.length === 0 && (
          <p className="mt-3 text-xs text-gray-500">No match for &ldquo;{query}&rdquo;.</p>
        )}
      </section>

      <section className="border rounded-md p-4">
        <h2 className="text-sm font-semibold mb-2">Inputs</h2>
        <Kv data={bundle.inputs as Record<string, unknown>} />
      </section>

      <section className="border rounded-md p-4">
        <h2 className="text-sm font-semibold mb-2">Files ({bundle.files.length})</h2>
        <table className="w-full text-xs">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-1">Name</th>
              <th>Detected</th>
              <th>Size</th>
              <th>SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {bundle.files.map((f) => (
              <tr key={f.fileId} className="border-t">
                <td className="py-1 font-mono">{f.fileName}</td>
                <td>{f.detectedType}</td>
                <td>{f.sizeBytes.toLocaleString()} B</td>
                <td className="font-mono text-[10px] text-gray-500">{f.sha256.slice(0, 16)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="border rounded-md p-4">
        <h2 className="text-sm font-semibold mb-2">Stages ({bundle.stages.length})</h2>
        <div className="space-y-2">
          {bundle.stages.map((stage, i) => {
            const key = `stage-${i}`;
            const open = expanded.has(key);
            return (
              <div key={key} className="border rounded">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium">
                    <span className="text-gray-400 mr-2">{i + 1}.</span>
                    {stage.name}
                  </span>
                  <span className="text-xs text-gray-500">{stage.durationMs}ms</span>
                </button>
                {open && (
                  <div className="p-3 border-t bg-gray-50 space-y-2">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase">Summary</p>
                      <Kv data={stage.summary} />
                    </div>
                    {stage.diagnostics && stage.diagnostics.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Diagnostics</p>
                        <ul className="text-xs list-disc pl-5">
                          {stage.diagnostics.map((d, j) => (
                            <li key={j}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {stage.data && (
                      <details>
                        <summary className="text-xs cursor-pointer text-blue-600">
                          Show full stage data
                        </summary>
                        <pre className="text-[10px] font-mono mt-2 max-h-96 overflow-auto bg-white p-2 border rounded">
                          {JSON.stringify(stage.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {bundle.outputs && (
        <section className="border rounded-md p-4">
          <h2 className="text-sm font-semibold mb-2">Outputs</h2>
          <Kv data={bundle.outputs} />
        </section>
      )}

      {bundle.error && (
        <section className="border rounded-md p-4 border-red-300 bg-red-50">
          <h2 className="text-sm font-semibold mb-2 text-red-700">Error</h2>
          <p className="text-xs font-mono">{bundle.error.message}</p>
          {bundle.error.stack && (
            <pre className="text-[10px] mt-2 overflow-auto max-h-64">{bundle.error.stack}</pre>
          )}
        </section>
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
    <details className="border rounded text-xs">
      <summary className="px-2 py-1.5 cursor-pointer hover:bg-gray-50">
        <span className="font-mono">{hit.kind}:{hit.id.slice(0, 12)}…</span>
        <span className="text-gray-500 ml-2">
          {Object.entries(hit.detail).map(([k, v]) => `${k}=${String(v)}`).join(' · ')}
        </span>
      </summary>
      <div className="p-2 border-t bg-gray-50 space-y-2">
        {voucher && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Voucher</p>
            <pre className="text-[10px] font-mono bg-white p-2 border rounded max-h-64 overflow-auto">
              {JSON.stringify(voucher, null, 2)}
            </pre>
          </div>
        )}
        {sourceEvents.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
              Source events ({sourceEvents.length})
            </p>
            <pre className="text-[10px] font-mono bg-white p-2 border rounded max-h-64 overflow-auto">
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
          <dt className="text-gray-500">{k}</dt>
          <dd className="font-mono break-all">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
