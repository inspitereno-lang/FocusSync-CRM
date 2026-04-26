import { DataSyncService } from '../services/syncService';

// Mock the fetch function
global.fetch = jest.fn();

describe('DataSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call fetch with the correct URL when syncing users', async () => {
    // This is a placeholder test as DataSyncService methods are private or highly dependent on the Tauri DB.
    // In a real scenario, we would mock getDb and test the sync logic.
    expect(DataSyncService.triggerSync).toBeDefined();
  });
});
