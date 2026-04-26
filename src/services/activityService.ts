import { getDb, resilientExecute } from "./db";
import { DataSyncService } from "./syncService";
import { invoke } from "@tauri-apps/api/core";

export interface Activity {
  id: string;
  user_name: string;
  user_id: string;
  action: string;
  status: "online" | "offline" | "away";
  time: string;
  synced?: number;
}

export class ActivityService {
  static async logActivity(activity: Partial<Activity>) {
    const id = crypto.randomUUID();
    let synced = 0;
    const now = new Date().toISOString();

    try {
      const result: any = await invoke("cloud_sync_post", { 
        collectionName: "activities", 
        data: [{ id, ...activity, time: now }] 
      });
      if (result.success) synced = 1;
    } catch (e) { }

    await resilientExecute(
      "INSERT INTO activities (id, user_name, user_id, action, status, time, synced) VALUES ($1, $2, $3, $4, $5, datetime('now'), $6)",
      [id, activity.user_name, activity.user_id, activity.action, activity.status, synced]
    );
    if (synced === 0) DataSyncService.triggerSync();
  }

  static async getActivities(limit = 20): Promise<Activity[]> {
    try {
      const db = await getDb();
      return await db.select<Activity[]>(
        "SELECT * FROM activities ORDER BY time DESC LIMIT $1",
        [limit]
      );
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}

export const logActivity = ActivityService.logActivity;
