import { useState, useEffect } from "react";
import { getDb } from "@/services/db";

export interface Session {
  id: string;
  user_id: string;
  login_time: string;
  logout_time: string | null;
  total_minutes: number;
}

export function useSessions(userId?: string) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const db = await getDb();
      let query = "SELECT * FROM sessions ORDER BY login_time DESC";
      let params: any[] = [];
      
      if (userId) {
        query = "SELECT * FROM sessions WHERE user_id = $1 ORDER BY login_time DESC";
        params = [userId];
      }
      
      const res = await db.select<Session[]>(query, params);
      setSessions(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [userId]);

  const getTodayMinutes = (uid: string) => {
    const today = new Date().toISOString().split('T')[0];
    return sessions
      .filter(s => s.user_id === uid && s.login_time.startsWith(today))
      .reduce((acc, s) => {
        if (s.logout_time) {
          return acc + (Number(s.total_minutes) || 0);
        } else {
          // If still logged in, calculate time since login
          const login = new Date(s.login_time).getTime();
          const now = new Date().getTime();
          const diff = Math.max(0, (now - login) / (1000 * 60));
          return acc + diff;
        }
      }, 0);
  };

  return { sessions, loading, getTodayMinutes, refresh: fetchSessions };
}
