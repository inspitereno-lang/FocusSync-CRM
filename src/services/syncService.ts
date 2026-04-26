import { getDb } from "./db";
import { APP_CONFIG, getApiUrl } from "./config";

/**
 * DataSyncService
 * 
 * Synchronizes local SQLite data with a remote MongoDB database.
 * Addresses: Hardcoded endpoints, Auth security, Error resilience, and Performance.
 */
export class DataSyncService {
  
  private static isSyncing = false;

  static async startSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      console.log("Initializing resilient data sync...");
      await this.pullAll();
      await this.pushAll();
    } finally {
      this.isSyncing = false;
    }
  }

  static async triggerSync() {
    if (this.isSyncing) {
      console.log("Sync cycle already in progress, skipping trigger.");
      return;
    }
    this.isSyncing = true;
    console.log("Triggering immediate sequential data sync...");
    try {
      await this.syncTasks();
      await this.syncSessions();
      await this.syncProctoringEvents();
      await this.syncUsers();
      await this.syncActivities();
      await this.syncMessages();
      await this.pullAll();
    } catch (e) {
      console.error("Sync cycle failed:", e);
    } finally {
      this.isSyncing = false;
    }
  }

  private static async pushAll() {
    await Promise.all([
      this.syncTasks(),
      this.syncSessions(),
      this.syncProctoringEvents(),
      this.syncUsers(),
      this.syncActivities()
    ]);
  }

  private static async pullAll() {
    const collections = [
      { cloud: "tasks", local: "tasks" },
      { cloud: "sessions", local: "sessions" },
      { cloud: "proctoring", local: "proctoring_events" },
      { cloud: "users", local: "users" },
      { cloud: "activities", local: "activities" },
      { cloud: "messages", local: "messages" }
    ];

    for (const coll of collections) {
      await this.pullCollection(coll.cloud, coll.local);
    }
  }

  /**
   * Resilient Fetch with Retry and Auth
   */
  private static async fetchWithRetry(url: string, options: RequestInit, retries = APP_CONFIG.RETRY_LIMIT): Promise<Response> {
    const headers = {
      ...options.headers,
      "Authorization": `Bearer ${APP_CONFIG.AUTH_TOKEN}`,
      "x-sync-source": "tauri-desktop",
      "Content-Type": "application/json"
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok && retries > 0) {
        console.warn(`Fetch failed with status ${response.status}. Retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, APP_CONFIG.RETRY_DELAY));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        console.error(`Network error. Retrying... (${retries} left)`, error);
        await new Promise(resolve => setTimeout(resolve, APP_CONFIG.RETRY_DELAY));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  private static async pullCollection(cloudCollection: string, localTable: string) {
    try {
      const url = `${getApiUrl(APP_CONFIG.SYNC_ENDPOINT)}?collection=${cloudCollection}`;
      const response = await this.fetchWithRetry(url, { method: "GET" });
      
      if (response.ok) {
        const remoteData = await response.json();
        if (Array.isArray(remoteData) && remoteData.length > 0) {
          await this.upsertToLocal(localTable, remoteData);
        }
      }
    } catch (error) {
      console.error(`Failed to pull ${cloudCollection} after retries:`, error);
    }
  }

  /**
   * Performance & Conflict Resolution: 
   * Compares timestamps to ensure only newer data overwrites local state.
   */
  private static async upsertToLocal(table: string, data: any[]) {
    const db = await getDb();
    
    try {
      const timestampFieldMap: Record<string, string> = {
        'tasks': 'updated_at',
        'sessions': 'updated_at',
        'proctoring_events': 'updated_at',
        'users': 'updated_at',
        'activities': 'time',
        'messages': 'timestamp'
      };

      const tsField = timestampFieldMap[table] || 'updated_at';

      // 1. Optimization: Fetch all local timestamps for this table at once
      const localMetadata = await db.select<any[]>(`SELECT id, ${tsField} FROM ${table}`);
      const localMap = new Map(localMetadata.map(m => [m.id, m[tsField]]));

      for (const item of data) {
        // Guard: Skip items with invalid/empty IDs to prevent junk data
        if (!item.id || String(item.id).trim() === "") {
          console.warn(`Sync: Skipping item with invalid ID in table ${table}`);
          continue;
        }

        const columns = Object.keys(item).filter(c => c !== 'id' && c !== 'synced' && c !== '_id');
        const values = columns.map(k => {
          const val = item[k];
          return (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
        });

        const localTsRaw = localMap.get(item.id);
        const existsLocally = localMap.has(item.id);

        if (existsLocally) {
          const localTs = localTsRaw ? new Date(localTsRaw).getTime() : 0;
          const remoteTs = new Date(item[tsField]).getTime();

          // ONLY update if remote is strictly newer
          if (remoteTs > localTs) {
            const setClause = columns.map((k, i) => `${k} = $${i + 1}`).join(", ");
            await this.executeWithRetry(db, 
              `UPDATE ${table} SET ${setClause}, synced = 1, last_cloud_sync = datetime('now') WHERE id = $${values.length + 1}`, 
              [...values, item.id]
            );
          }
        } else {
          // New record from cloud
          const allCols = ["id", ...columns, "synced", "last_cloud_sync"].join(",");
          const placeholders = ["$1", ...columns.map((_, i) => `$${i + 2}`), `$${values.length + 2}`, "datetime('now')"].join(",");
          await this.executeWithRetry(db, `INSERT OR IGNORE INTO ${table} (${allCols}) VALUES (${placeholders})`, [item.id, ...values, 1]);
        }
      }
    } catch (error) {
      console.error(`Sync: Failed to upsert ${table} data:`, error);
    }
  }

  private static async executeWithRetry(db: any, sql: string, params: any[] = [], retries = 5): Promise<any> {
    try {
      return await db.execute(sql, params);
    } catch (e: any) {
      const errorMsg = String(e);
      if (errorMsg.includes("database is locked") && retries > 0) {
        console.warn(`Database busy, retrying in 500ms... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.executeWithRetry(db, sql, params, retries - 1);
      }
      throw e;
    }
  }

  private static async syncTable(table: string, cloudColl: string) {
    const db = await getDb();
    const records = await db.select<any[]>(`SELECT * FROM ${table} WHERE synced = 0`);
    
    if (records.length > 0) {
      const success = await this.postToCloud(cloudColl, records);
      if (success) {
        const ids = records.map(r => `'${r.id}'`).join(",");
        await db.execute(`UPDATE ${table} SET synced = 1 WHERE id IN (${ids})`);
      }
    }
  }

  private static async syncTasks() { await this.syncTable("tasks", "tasks"); }
  private static async syncSessions() { await this.syncTable("sessions", "sessions"); }
  private static async syncProctoringEvents() { await this.syncTable("proctoring_events", "proctoring"); }
  private static async syncUsers() { await this.syncTable("users", "users"); }
  private static async syncActivities() { await this.syncTable("activities", "activities"); }
  private static async syncMessages() { await this.syncTable("messages", "messages"); }

  private static async postToCloud(collection: string, data: any[]) {
    try {
      const url = getApiUrl(APP_CONFIG.SYNC_ENDPOINT);
      const response = await this.fetchWithRetry(url, {
        method: "POST",
        body: JSON.stringify({ collection, data, timestamp: new Date().toISOString() })
      });
      return response.ok;
    } catch (error) {
      console.error(`Cloud Sync Error (${collection}) after retries:`, error);
      return false;
    }
  }
}
