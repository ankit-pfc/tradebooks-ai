import { describe, expect, it, vi, beforeEach } from 'vitest';

const stockMappingRepo = {
  listMappings: vi.fn(),
  listMappingsPaged: vi.fn(),
  upsertMapping: vi.fn(),
  bulkUpsertMappings: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  getStockMappingRepository: () => stockMappingRepo,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-001' } } }),
    },
  }),
}));

const { GET, POST } = await import('@/app/api/ledger-masters/security-mappings/route');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/ledger-masters/security-mappings', () => {
  it('forwards search + pagination params and returns the total', async () => {
    stockMappingRepo.listMappingsPaged.mockResolvedValueOnce({
      mappings: [{ id: 'm1', broker_symbol: 'WIPRO-EQ' }],
      total: 42,
    });

    const res = await GET(
      new Request(
        'http://localhost/api/ledger-masters/security-mappings?q=wipro&limit=20&offset=20',
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(42);
    expect(body.offset).toBe(20);
    expect(body.limit).toBe(20);
    expect(body.mappings).toHaveLength(1);
    expect(stockMappingRepo.listMappingsPaged).toHaveBeenCalledWith('user-001', {
      query: 'wipro',
      limit: 20,
      offset: 20,
    });
  });

  it('omits the query and defaults offset to 0 when params are absent', async () => {
    stockMappingRepo.listMappingsPaged.mockResolvedValueOnce({ mappings: [], total: 0 });

    await GET(new Request('http://localhost/api/ledger-masters/security-mappings'));

    expect(stockMappingRepo.listMappingsPaged).toHaveBeenCalledWith('user-001', {
      query: undefined,
      limit: undefined,
      offset: 0,
    });
  });

  it('ignores invalid limit/offset values', async () => {
    stockMappingRepo.listMappingsPaged.mockResolvedValueOnce({ mappings: [], total: 0 });

    await GET(
      new Request('http://localhost/api/ledger-masters/security-mappings?limit=abc&offset=-5'),
    );

    expect(stockMappingRepo.listMappingsPaged).toHaveBeenCalledWith('user-001', {
      query: undefined,
      limit: undefined,
      offset: 0,
    });
  });
});

describe('POST /api/ledger-masters/security-mappings', () => {
  it('bulk saves confirmed security mappings', async () => {
    stockMappingRepo.bulkUpsertMappings.mockResolvedValueOnce([
      {
        id: 'mapping-wipro',
        user_id: 'user-001',
        security_id: 'ISIN:INE075A01022',
        broker_symbol: 'WIPRO-EQ',
        isin: 'INE075A01022',
        tally_ledger_name: 'WIPRO-SH',
        tally_ledger_group: 'INVESTMENT IN SHARES-ZERODHA',
        tally_stock_item_name: 'WIPRO-SH',
        base_unit: 'NOS',
        match_source: 'auto_pattern',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);

    const res = await POST(new Request('http://localhost/api/ledger-masters/security-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mappings: [
          {
            security_id: 'ISIN:INE075A01022',
            broker_symbol: 'WIPRO-EQ',
            isin: 'INE075A01022',
            tally_ledger_name: 'WIPRO-SH',
            tally_ledger_group: 'INVESTMENT IN SHARES-ZERODHA',
            tally_stock_item_name: 'WIPRO-SH',
            base_unit: 'NOS',
            match_source: 'auto_pattern',
          },
        ],
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mappings).toHaveLength(1);
    expect(stockMappingRepo.bulkUpsertMappings).toHaveBeenCalledWith('user-001', [
      {
        security_id: 'ISIN:INE075A01022',
        broker_symbol: 'WIPRO-EQ',
        isin: 'INE075A01022',
        tally_ledger_name: 'WIPRO-SH',
        tally_ledger_group: 'INVESTMENT IN SHARES-ZERODHA',
        tally_stock_item_name: 'WIPRO-SH',
        base_unit: 'NOS',
        match_source: 'auto_pattern',
      },
    ]);
  });

  it('keeps the existing single-mapping response shape', async () => {
    stockMappingRepo.upsertMapping.mockResolvedValueOnce({
      id: 'mapping-pocl',
      user_id: 'user-001',
      security_id: 'ISIN:INE035S01010',
      broker_symbol: 'POCL-EQ',
      isin: 'INE035S01010',
      tally_ledger_name: 'POCL-EQ-SH',
      tally_ledger_group: 'INVESTMENT IN SHARES-ZERODHA',
      tally_stock_item_name: 'POCL-EQ-SH',
      base_unit: 'NOS',
      match_source: 'manual',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    const res = await POST(new Request('http://localhost/api/ledger-masters/security-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        security_id: 'ISIN:INE035S01010',
        broker_symbol: 'POCL-EQ',
        isin: 'INE035S01010',
        tally_ledger_name: 'POCL-EQ-SH',
        tally_ledger_group: 'INVESTMENT IN SHARES-ZERODHA',
        tally_stock_item_name: 'POCL-EQ-SH',
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.broker_symbol).toBe('POCL-EQ');
    expect(stockMappingRepo.upsertMapping).toHaveBeenCalledOnce();
    expect(stockMappingRepo.bulkUpsertMappings).not.toHaveBeenCalled();
  });

  it('rejects mappings that point stock securities to dividend or charge ledgers', async () => {
    const res = await POST(new Request('http://localhost/api/ledger-masters/security-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        security_id: 'ISIN:INE075A01022',
        broker_symbol: 'WIPRO',
        isin: 'INE075A01022',
        tally_ledger_name: 'DIV WIPRO',
        tally_ledger_group: 'Div on Shares',
        tally_stock_item_name: 'DIV WIPRO',
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid stock mapping for WIPRO');
    expect(stockMappingRepo.upsertMapping).not.toHaveBeenCalled();
    expect(stockMappingRepo.bulkUpsertMappings).not.toHaveBeenCalled();
  });
});
