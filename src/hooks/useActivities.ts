import { useState, useEffect, useCallback } from "react";
import { getDb } from "@/services/db";
import { ActivityService, Activity } from "@/services/activityService";

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      const db = await getDb();
      const res = await db.select<Activity[]>(
        "SELECT * FROM activities ORDER BY time DESC LIMIT 20"
      );
      
      const processed = res.map(a => {
        const diff = Math.floor((new Date().getTime() - new Date(a.time).getTime()) / 1000);
        let timeLabel = "Just now";
        if (diff > 3600) timeLabel = `${Math.floor(diff/3600)}h ago`;
        else if (diff > 60) timeLabel = `${Math.floor(diff/60)}m ago`;
        else if (diff > 0) timeLabel = `${diff}s ago`;
        
        return { ...a, time: timeLabel };
      });

      setActivities(processed);
    } catch (e) {
      console.error("Failed to fetch activities", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const logActivity = async (activity: Omit<Activity, "id" | "time">) => {
    await ActivityService.logActivity(activity);
    await fetchActivities();
  };

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 15000); // Refresh every 15s for more real-time feel
    return () => clearInterval(interval);
  }, [fetchActivities]);

  return { activities, loading, logActivity, refresh: fetchActivities };
}
