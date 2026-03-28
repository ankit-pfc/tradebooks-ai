import { vi } from 'vitest';
import type { BatchRepository } from '@/lib/db/repository';
import type { SettingsRepository } from '@/lib/db/settings-repository';

/**
 * Creates a mock BatchRepository with all methods as vi.fn() returning sensible defaults.
 */
export function mockBatchRepo(): { [K in keyof BatchRepository]: ReturnType<typeof vi.fn> } {
    return {
        createBatch: vi.fn(),
        getBatch: vi.fn().mockResolvedValue(null),
        listBatches: vi.fn().mockResolvedValue([]),
        updateBatchStatus: vi.fn(),
        addUploadedFiles: vi.fn(),
        resolveUploadedFilePath: vi.fn().mockResolvedValue(null),
        saveProcessingOutput: vi.fn(),
        saveExportArtifacts: vi.fn(),
        resolveArtifactPath: vi.fn().mockResolvedValue(null),
        listExceptions: vi.fn().mockResolvedValue([]),
        buildDashboardSummary: vi.fn().mockResolvedValue({
            summary: { total_batches: 0, total_vouchers: 0, success_rate: null, open_exceptions: 0 },
            recent_batches: [],
        }),
        saveClosingLots: vi.fn(),
        getClosingLots: vi.fn().mockResolvedValue(null),
        listPriorBatches: vi.fn().mockResolvedValue([]),
    };
}

/**
 * Creates a mock SettingsRepository with all methods as vi.fn().
 */
export function mockSettingsRepo(): { [K in keyof SettingsRepository]: ReturnType<typeof vi.fn> } {
    return {
        getSettings: vi.fn().mockResolvedValue(null),
        upsertSettings: vi.fn(),
    };
}
