import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface Session {
  id: string;
  user_id: string;
  login_time: string;
  logout_time: string | null;
  last_ping: string;
  total_minutes: number;
  total_keystrokes: number;
  face_missing_duration: number;
  integrity_score: number;
}

export function useSessions(userId?: string) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const filter = userId ? { user_id: userId } : undefined;
      const res: any[] = await invoke("cloud_sync_get", { collectionName: "sessions", filter });
      setSessions(res);
    } catch (e) {
      console.error("Failed to fetch sessions from MongoDB:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const getTodayMinutes = (targetUserId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return sessions
      .filter(s => s.user_id === targetUserId && s.login_time.startsWith(today))
      .reduce((acc, s) => acc + (s.total_minutes || 0), 0);
  };

  return { sessions, loading, refresh: fetchSessions, getTodayMinutes };
}
