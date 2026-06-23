import { describe, expect, it, vi, beforeEach } from 'vitest';

const ledgerRepo = {
  listOverrides: vi.fn(),
  upsertOverride: vi.fn(),
  bulkUpsertOverrides: vi.fn(),
  deleteOverride: vi.fn(),
};

const stockItemRepo = {
  listStockItems: vi.fn(),
  bulkUpsertStockItems: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  getLedgerRepository: () => ledgerRepo,
  getStockItemRepository: () => stockItemRepo,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-001' } } }),
    },
  }),
}));

const { POST } = await import('@/app/api/ledger-masters/upload/route');

beforeEach(() => {
  vi.clearAllMocks();
  ledgerRepo.bulkUpsertOverrides.mockResolvedValue([]);
  stockItemRepo.bulkUpsertStockItems.mockResolvedValue([]);
});

describe('POST /api/ledger-masters/upload', () => {
  it('warns and avoids persisting AMC Charges as the broker override', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <ENVELOPE><BODY><IMPORTDATA><REQUESTDATA>
        <TALLYMESSAGE>
          <LEDGER NAME="AMC CHARGES-ZERODHA" ACTION="Create">
            <NAME.LIST><NAME>AMC CHARGES-ZERODHA</NAME></NAME.LIST>
            <PARENT>Sundry Creditors</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE>
          <LEDGER NAME="ZERODHA - KITE" ACTION="Create">
            <NAME.LIST><NAME>ZERODHA - KITE</NAME></NAME.LIST>
            <PARENT>Sundry Creditors</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;

    const res = await POST(new Request('http://localhost/api/ledger-masters/upload', {
      method: 'POST',
      body: xml,
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.warnings).toEqual([
      expect.stringContaining('AMC CHARGES-ZERODHA'),
    ]);
    expect(ledgerRepo.bulkUpsertOverrides).toHaveBeenCalledOnce();
    const savedInputs = ledgerRepo.bulkUpsertOverrides.mock.calls[0][1];
    expect(savedInputs).toContainEqual(
      expect.objectContaining({
        ledger_key: 'BROKER',
        name: 'ZERODHA - KITE',
      }),
    );
    expect(savedInputs).not.toContainEqual(
      expect.objectContaining({
        ledger_key: 'BROKER',
        name: 'AMC CHARGES-ZERODHA',
      }),
    );
  });
});
