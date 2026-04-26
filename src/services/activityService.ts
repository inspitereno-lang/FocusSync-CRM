import { getDb, resilientExecute } from "./db";
import { DataSyncService } from "./syncService";
import { APP_CONFIG } from "./config";

export interface ActivityLog {
  id: string;
  user_name: string;
  user_id: string;
  action: string;
  time: string;
  status: "online" | "away" | "offline";
}

export class ActivityService {
  static async logActivity(activity: Omit<ActivityLog, "id" | "time">) {
    const id = crypto.randomUUID();
    let synced = 0;
    const now = new Date().toISOString();

    // 1. Try Cloud Update First
    try {
      const url = `${APP_CONFIG.CLOUD_API_BASE}${APP_CONFIG.SYNC_ENDPOINT}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${APP_CONFIG.AUTH_TOKEN}`
        },
        body: JSON.stringify({ 
          collection: "activities", 
          data: [{ id, ...activity, time: now }] 
        })
      });
      if (response.ok) {
        synced = 1;
      }
    } catch (e) {
      console.warn("Cloud activity log failed, will sync later:", e);
    }

    try {
      await resilientExecute(
        "INSERT INTO activities (id, user_name, user_id, action, status, synced, time) VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))",
        [id, activity.user_name, activity.user_id, activity.action, activity.status, synced]
      );
      if (synced === 0) await DataSyncService.triggerSync();
    } catch (e) {
      console.error("Failed to log activity locally:", e);
    }
  }
}
