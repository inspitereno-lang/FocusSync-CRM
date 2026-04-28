import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface Activity {
  id: string;
  user_name: string;
  user_id: string;
  action: string;
  time: string;
  status: "online" | "away" | "offline";
}

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      // Fetch only the most recent activities to handle scale (100+ users)
      const res: any[] = await invoke("cloud_sync_get", { 
        collectionName: "activities" 
      });
      // Rust backend already sorts by updated_at: -1
      // We slice here just in case to keep the UI snappy
      setActivities(res.slice(0, 50));
    } catch (e) {
      console.error("Failed to fetch activities from MongoDB:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 10000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  const logActivity = async (activity: Omit<Activity, "id" | "time">) => {
    const id = crypto.randomUUID();
    const newActivity = {
      ...activity,
      id,
      time: new Date().toISOString()
    };

    try {
      await invoke("cloud_sync_upsert", { 
        collectionName: "activities",
        id,
        data: newActivity 
      });
      setActivities(prev => [newActivity as Activity, ...prev].slice(0, 50));
    } catch (e) {
      console.error("Failed to log activity to MongoDB:", e);
    }
  };

  return { activities, loading, logActivity, refresh: fetchActivities };
}
