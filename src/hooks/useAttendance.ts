import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useAttendance() {
  const logSessionStart = async (userId: string) => {
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await invoke("cloud_sync_upsert", {
        collectionName: "sessions",
        id: sessionId,
        data: {
          id: sessionId,
          user_id: userId,
          login_time: now,
          logout_time: null,
          last_ping: now,
          total_minutes: 0,
          total_keystrokes: 0,
          face_missing_duration: 0,
          integrity_score: 100
        }
      });
      localStorage.setItem("current_session_id", sessionId);
    } catch (e) {
      console.error("Failed to start session in MongoDB:", e);
    }
  };

  const logSessionEnd = async (userId: string) => {
    const sessionId = localStorage.getItem("current_session_id");
    if (!sessionId) return;
    
    const now = new Date().toISOString();
    try {
      await invoke("cloud_sync_upsert", {
        collectionName: "sessions",
        id: sessionId,
        data: { logout_time: now }
      });
      localStorage.removeItem("current_session_id");
    } catch (e) {
      console.error("Failed to end session in MongoDB:", e);
    }
  };

  const logPing = async (userId: string) => {
    const sessionId = localStorage.getItem("current_session_id");
    if (!sessionId) return;

    try {
      await invoke("cloud_sync_upsert", {
        collectionName: "sessions",
        id: sessionId,
        data: { last_ping: new Date().toISOString() }
      });
    } catch (e) {
      console.error("Failed to ping session in MongoDB:", e);
    }
  };

  const updateSessionStats = async (userId: string, stats: { 
    keystrokes: number, 
    faceMissingSeconds: number, 
    activeSeconds: number,
    integrityScore: number 
  }) => {
    const sessionId = localStorage.getItem("current_session_id");
    if (!sessionId) return;

    try {
      // Fetch current session to increment stats
      const sessions: any[] = await invoke("cloud_sync_get", { 
        collectionName: "sessions", 
        filter: { id: sessionId } 
      });
      
      if (sessions.length > 0) {
        const s = sessions[0];
        await invoke("cloud_sync_upsert", {
          collectionName: "sessions",
          id: sessionId,
          data: {
            total_minutes: (s.total_minutes || 0) + Math.round(stats.activeSeconds / 60),
            total_keystrokes: (s.total_keystrokes || 0) + stats.keystrokes,
            face_missing_duration: (s.face_missing_duration || 0) + stats.faceMissingSeconds,
            integrity_score: stats.integrityScore
          }
        });
      }
    } catch (e) {
      console.error("Failed to update session stats in MongoDB:", e);
    }
  };

  const logProctoringEvent = async (userId: string, eventType: string, durationSeconds: number) => {
    const id = crypto.randomUUID();
    try {
      await invoke("cloud_sync_upsert", {
        collectionName: "proctoring_events",
        id,
        data: {
          id,
          user_id: userId,
          event_type: eventType,
          start_time: new Date().toISOString(),
          duration_seconds: durationSeconds
        }
      });
    } catch (e) {
      console.error("Failed to log proctoring event to MongoDB:", e);
    }
  };

  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [proctoringAlerts, setProctoringAlerts] = useState<any[]>([]);

  const fetchActiveStatus = async () => {
    try {
      const res: any[] = await invoke("cloud_get_active_sessions");
      setActiveSessions(res);
    } catch (e) {
      console.error("Failed to fetch active sessions:", e);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res: any[] = await invoke("cloud_get_proctoring_alerts");
      setProctoringAlerts(res);
    } catch (e) {
      console.error("Failed to fetch proctoring alerts:", e);
    }
  };

  const clearAttendanceData = async () => {
    try {
      await invoke("cloud_clear_attendance_data");
    } catch (e) {
      console.error("Failed to clear attendance data:", e);
    }
  };

  const fetchAllUserStats = async () => {
    // This could fetch aggregated stats if needed, 
    // for now we use the existing cloud_sync_get with sessions
    try {
      const sessions: any[] = await invoke("cloud_sync_get", { collectionName: "sessions" });
      return sessions;
    } catch (e) {
      console.error("Failed to fetch all user stats:", e);
      return [];
    }
  };

  return { 
    logSessionStart, 
    logSessionEnd, 
    logPing, 
    updateSessionStats, 
    logProctoringEvent,
    activeSessions,
    proctoringAlerts,
    fetchActiveStatus,
    fetchAlerts,
    fetchAllUserStats,
    clearAttendanceData
  };
}
