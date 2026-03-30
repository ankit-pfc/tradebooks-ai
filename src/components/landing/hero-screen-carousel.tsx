function DashboardScreen() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-[#0B1F33]">Dashboard</p>
          <p className="text-[8px] text-[#6B7280]">Your broker-to-Tally bridge</p>
        </div>
        <div className="rounded-md bg-[#0B1F33] px-1.5 py-px">
          <p className="text-[8px] font-semibold text-white">+ New Import</p>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-2 gap-1">
        {[
          { label: "Total Batches", value: "3", sub: "Import batches" },
          { label: "Vouchers", value: "550", sub: "Tally-ready" },
          { label: "Success Rate", value: "67%", sub: "Pass rate" },
          { label: "Exceptions", value: "0", sub: "For review" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-[#E5E7EB] bg-white px-1.5 py-1">
            <p className="text-[7px] text-[#6B7280]">{s.label}</p>
            <p className="text-[11px] font-bold text-[#0B1F33]">{s.value}</p>
            <p className="text-[6px] text-[#9CA3AF]">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-2 py-0.5">
          <p className="text-[9px] font-semibold text-[#0B1F33]">Recent Import Batches</p>
        </div>
        <div className="divide-y divide-[#F3F4F6]">
          {[
            { company: "test client1", date: "29 Mar 2026", status: "Succeeded", vouchers: 275 },
            { company: "test client", date: "29 Mar 2026", status: "Succeeded", vouchers: 275 },
            { company: "test client", date: "29 Mar 2026", status: "Queued", vouchers: 0 },
          ].map((b, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-0.5">
              <div>
                <p className="text-[8px] font-medium text-[#0B1F33]">{b.company}</p>
                <p className="text-[6px] text-[#9CA3AF]">{b.date}</p>
              </div>
              <div className="flex items-center gap-1">
                <p className="text-[8px] text-[#6B7280]">{b.vouchers}</p>
                <span
                  className={`rounded-full px-1 py-px text-[6px] font-bold ${
                    b.status === "Succeeded"
                      ? "bg-[#2D9D78]/10 text-[#2D9D78]"
                      : "bg-[#F3F4F6] text-[#6B7280]"
                  }`}
                >
                  {b.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadScreen() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] p-2">
      <div className="mb-1.5">
        <p className="text-[10px] font-bold text-[#0B1F33]">New Import</p>
        <p className="text-[8px] text-[#6B7280]">Upload your Zerodha exports</p>
      </div>

      <div className="mb-1.5 rounded-lg border border-[#E5E7EB] bg-white p-1.5">
        <p className="mb-0.5 text-[8px] font-semibold text-[#374151]">Accounting Mode</p>
        <div className="flex gap-1">
          <div className="flex-1 rounded-md bg-[#0B1F33] px-1.5 py-px text-center">
            <p className="text-[8px] font-semibold text-white">Investor</p>
          </div>
          <div className="flex-1 rounded-md border border-[#E5E7EB] px-1.5 py-px text-center">
            <p className="text-[8px] font-medium text-[#6B7280]">Trader</p>
          </div>
        </div>
      </div>

      <div className="mb-1.5 rounded-lg border-2 border-dashed border-[#D1D5DB] bg-white p-1.5 text-center">
        <div className="mx-auto mb-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#EFF6FF]">
          <span className="text-[9px] font-bold text-[#1E4FD8]">↑</span>
        </div>
        <p className="text-[8px] font-medium text-[#374151]">Drag & drop Zerodha CSV files</p>
        <p className="text-[6px] text-[#9CA3AF]">tradebook, funds statement, holdings</p>
      </div>

      <div className="mb-1.5 space-y-0.5">
        {[
          { name: "zerodha_tradebook.csv", size: "42 KB" },
          { name: "funds_statement.csv", size: "18 KB" },
        ].map((f) => (
          <div
            key={f.name}
            className="flex items-center justify-between rounded-md border border-[#E5E7EB] bg-white px-1.5 py-px"
          >
            <p className="max-w-[140px] truncate text-[8px] font-medium text-[#374151]">{f.name}</p>
            <div className="flex items-center gap-1">
              <p className="text-[7px] text-[#9CA3AF]">{f.size}</p>
              <span className="text-[8px] text-[#2D9D78]">✓</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-[#0B1F33] px-2 py-1 text-center">
        <p className="text-[9px] font-semibold text-white">Process Import →</p>
      </div>
    </div>
  );
}

function BatchScreen() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC] p-2">
      <div className="mb-1.5">
        <p className="text-[10px] font-bold text-[#0B1F33]">Batch #3 — test client1</p>
        <p className="text-[8px] text-[#6B7280]">05 Apr 2024 – 02 Aug 2024</p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white p-1.5">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#475569]">
            Batch Preview
          </p>
          <span className="inline-flex items-center gap-0.5 rounded-full border border-[#2D9D78]/30 bg-[#2D9D78]/10 px-1 py-px text-[6px] font-bold text-[#2D9D78]">
            ● 42 ready
          </span>
        </div>

        <div className="mb-1 flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FBFF] px-1.5 py-0.5">
          <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-[#1E4FD8] text-[7px] font-bold text-white">
            Z
          </div>
          <div className="h-px flex-1 bg-[#D6E3F3]" />
          <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-[#1E4FD8]/15 text-[7px] font-bold text-[#1E4FD8]">
            AI
          </div>
          <div className="h-px flex-1 bg-[#D6E3F3]" />
          <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-[#2D9D78]/15 text-[7px] font-bold text-[#2D9D78]">
            T
          </div>
        </div>

        <div className="space-y-0.5">
          {[
            { symbol: "RELIANCE · CNC", amount: "₹24,580", ok: true },
            { symbol: "HDFCBANK · MIS", amount: "₹8,120", ok: true },
            { symbol: "INFY · CNC", amount: "₹12,040", ok: false },
          ].map((row) => (
            <div
              key={row.symbol}
              className="flex items-center justify-between rounded-md border border-[#E2E8F0] bg-white px-1.5 py-px"
            >
              <p className="text-[8px] font-semibold text-[#1A1A2E]">{row.symbol}</p>
              <div className="flex items-center gap-1">
                <p className="text-[8px] font-semibold text-[#1A1A2E]">{row.amount}</p>
                <span
                  className={`rounded-full px-1 py-px text-[6px] font-bold ${
                    row.ok ? "bg-[#2D9D78]/10 text-[#2D9D78]" : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {row.ok ? "Ready" : "Review"}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between rounded-md bg-[#F3F6FB] px-1.5 py-px">
          <p className="text-[8px] font-medium text-[#475569]">Exceptions: 2</p>
          <p className="text-[8px] font-semibold text-[#1E4FD8]">Export XML →</p>
        </div>
      </div>
    </div>
  );
}

export function HeroScreenCarousel() {
  return (
    <div className="relative h-full overflow-hidden">
        <div className="absolute inset-0" style={{ animation: "heroScreen1 12s ease-in-out infinite" }}>
          <DashboardScreen />
        </div>
        <div className="absolute inset-0" style={{ animation: "heroScreen2 12s ease-in-out infinite" }}>
          <UploadScreen />
        </div>
        <div className="absolute inset-0" style={{ animation: "heroScreen3 12s ease-in-out infinite" }}>
          <BatchScreen />
        </div>
    </div>
  );
}
