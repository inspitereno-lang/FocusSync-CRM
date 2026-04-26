// This file is deprecated. FocusSync now uses a cloud-first architecture.
// Data is written directly to MongoDB via the Rust bridge.
export const DataSyncService = {
  triggerSync: () => {
    console.warn("DataSyncService.triggerSync is deprecated. All writes are now cloud-direct.");
  }
};
