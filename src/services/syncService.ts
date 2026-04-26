import { getDb } from "./db";
import { invoke } from "@tauri-apps/api/core";

/**
 * DataSyncService
 * 
 * Synchronizes local SQLite data with a remote MongoDB database.
 * Now uses native Rust bridge (Tauri Commands) instead of external HTTP fetch.
 */
export class DataSyncService {
  
  private static isSyncing = false;

  static async startSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      console.log("Initializing resilient data sync via Rust bridge...");
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
    try {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("sync-status", { title: "Syncing", message: "Updating cloud data...", type: "info" });

      await this.syncTasks();
      await this.syncSessions();
      await this.syncProctoringEvents();
      await this.syncUsers();
      await this.syncActivities();
      await this.syncMessages();
      await this.pullAll();

      await emit("sync-status", { title: "Sync Complete", message: "All data is up to date.", type: "success" });
    } catch (e) {
      console.error("Sync cycle failed:", e);
      const { emit } = await import("@tauri-apps/api/event");
      await emit("sync-status", { title: "Sync Error", message: "Check your connection.", type: "error" });
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

  private static async pullCollection(cloudCollection: string, localTable: string) {
    try {
      // ✅ Call native Rust command
      const remoteData: any[] = await invoke("cloud_sync_get", { collectionName: cloudCollection });
      
      if (Array.isArray(remoteData) && remoteData.length > 0) {
        await this.upsertToLocal(localTable, remoteData);
      }
    } catch (error) {
      console.error(`Failed to pull ${cloudCollection} via Rust bridge:`, error);
    }
  }

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
      const localMetadata = await db.select<any[]>(`SELECT id, ${tsField} FROM ${table}`);
      const localMap = new Map(localMetadata.map(m => [m.id, m[tsField]]));

      for (const item of data) {
        if (!item.id || String(item.id).trim() === "") continue;

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

          if (remoteTs > localTs) {
            const setClause = columns.map((k, i) => `${k} = $${i + 1}`).join(", ");
            await this.executeWithRetry(db, 
              `UPDATE ${table} SET ${setClause}, synced = 1, last_cloud_sync = datetime('now') WHERE id = $${values.length + 1}`, 
              [...values, item.id]
            );
          }
        } else {
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
      // ✅ Call native Rust command
      const result: any = await invoke("cloud_sync_post", { collectionName: collection, data });
      return !!result.success;
    } catch (error) {
      console.error(`Cloud Sync Error via Rust (${collection}):`, error);
      return false;
    }
  }
}
