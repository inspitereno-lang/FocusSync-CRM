// This file is deprecated. FocusSync now uses a cloud-first architecture via MongoDB.
// Local SQLite (tauri-plugin-sql) has been removed.
export const getDb = async () => {
  throw new Error("Local database is deprecated. Use cloud_sync_* commands via Rust bridge.");
};

export const resilientExecute = async () => {
  throw new Error("Local database is deprecated. Use cloud_sync_* commands via Rust bridge.");
};
