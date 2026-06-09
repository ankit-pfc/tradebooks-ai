import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mockBatchRepo, mockSettingsRepo } from './_helpers';

const batchRepo = mockBatchRepo();
const settingsRepo = mockSettingsRepo();

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
const stockMappingRepo = {
  listMappings: vi.fn(),
  upsertMapping: vi.fn(),
  bulkUpsertMappings: vi.fn(),
};
const storage = {
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  getBatchRepository: () => batchRepo,
  getSettingsRepository: () => settingsRepo,
  getLedgerRepository: () => ledgerRepo,
  getStockItemRepository: () => stockItemRepo,
  getStockMappingRepository: () => stockMappingRepo,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-001' } } }),
    },
  }),
}));

vi.mock('@/lib/storage/file-storage', () => ({
  getFileStorage: () => storage,
}));

const { GET } = await import('@/app/api/batches/[batchId]/tally-mapping-preview/route');

const tradebookCsv = Buffer.from([
  'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
  '2024-06-15,NSE,EQ,INFY,INE009A01021,BUY,1,1500.00,CNC,T1,O1,09:15:00',
  '2024-06-15,NSE,EQ,WIPRO-EQ,INE075A01022,BUY,1,500.00,CNC,T2,O2,09:16:00',
  '2024-06-15,NSE,EQ,POCL-EQ,INE035S01010,BUY,1,100.00,CNC,T3,O3,09:17:00',
].join('\n'));

beforeEach(() => {
  vi.clearAllMocks();
  batchRepo.getBatch.mockResolvedValue({
    id: 'batch-001',
    user_id: 'user-001',
    company_name: 'Test Co',
    accounting_mode: 'investor',
    period_from: '2024-04-01',
    period_to: '2025-03-31',
    status: 'uploading',
    status_message: null,
    file_count: 1,
    voucher_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  });
  batchRepo.getFilesByBatch.mockResolvedValue([
    {
      id: 'file-001',
      batch_id: 'batch-001',
      file_name: 'tradebook.csv',
      mime_type: 'text/csv',
      size_bytes: tradebookCsv.length,
      detected_type: 'tradebook',
      status: 'uploaded',
      content_hash: null,
      error_message: null,
      uploaded_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);
  batchRepo.resolveUploadedFilePath.mockResolvedValue('/storage/tradebook.csv');
  storage.download.mockResolvedValue(tradebookCsv);
  settingsRepo.getSettings.mockResolvedValue(null);
  ledgerRepo.listOverrides.mockResolvedValue([
    {
      id: 'ledger-wipro',
      user_id: 'user-001',
      ledger_key: 'WIPRO_SH',
      name: 'WIPRO-SH',
      parent_group: 'INVESTMENT IN SHARES-ZERODHA',
      is_custom: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);
  stockItemRepo.listStockItems.mockResolvedValue([]);
  stockMappingRepo.listMappings.mockResolvedValue([
    {
      id: 'mapping-infy',
      user_id: 'user-001',
      security_id: 'ISIN:INE009A01021',
      broker_symbol: 'INFY',
      isin: 'INE009A01021',
      tally_ledger_name: 'Infosys Ltd',
      tally_ledger_group: 'INVESTMENT IN SHARES-ZERODHA',
      tally_stock_item_name: 'Infosys Ltd',
      base_unit: 'NOS',
      match_source: 'manual',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ]);
});

describe('GET /api/batches/[batchId]/tally-mapping-preview', () => {
  it('returns saved, suggested, and missing mapping rows', async () => {
    const res = await GET(new Request('http://localhost/api/batches/batch-001/tally-mapping-preview'), {
      params: Promise.resolve({ batchId: 'batch-001' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.summary).toMatchObject({
      total: 3,
      saved: 1,
      suggested: 1,
      missing: 1,
    });

    expect(body.rows.find((row: { broker_symbol: string }) => row.broker_symbol === 'INFY')).toMatchObject({
      status: 'saved',
      suggested_ledger_name: 'Infosys Ltd',
    });
    expect(body.rows.find((row: { broker_symbol: string }) => row.broker_symbol === 'WIPRO-EQ')).toMatchObject({
      status: 'suggested',
      suggested_ledger_name: 'WIPRO-SH',
    });
    expect(body.rows.find((row: { broker_symbol: string }) => row.broker_symbol === 'POCL-EQ')).toMatchObject({
      status: 'missing',
      confidence: 'generated',
    });
  });
});
