import { useState, useEffect, useCallback } from "react";
import { getDb, resilientExecute } from "@/services/db";
import { DataSyncService } from "@/services/syncService";
import { invoke } from "@tauri-apps/api/core";

export interface Session {
  id: string;
  user_id: string;
  login_time: string;
  logout_time: string | null;
  last_ping: string;
  total_minutes: number;
}

export interface ProctoringEvent {
  id: string;
  user_id: string;
  event_type: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
}

export function useAttendance() {
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [proctoringAlerts, setProctoringAlerts] = useState<ProctoringEvent[]>([]);

  const fetchActiveStatus = useCallback(async (isCloud: boolean = false) => {
    try {
      if (isCloud) {
        // ✅ Call native Rust command
        const res: any[] = await invoke("cloud_get_active_sessions");
        setActiveSessions(res);
        return;
      }
      
      const db = await getDb();
      const res = await db.select<any[]>(`
        SELECT u.name, u.email, u.role, s.login_time, s.last_ping 
        FROM users u
        JOIN sessions s ON u.id = s.user_id
        WHERE u.is_deleted = 0
        AND s.logout_time IS NULL 
        AND s.last_ping > datetime('now', '-5 minutes')
      `);
      setActiveSessions(res);
    } catch (e) {
      console.error("Failed to fetch active status via Rust:", e);
    }
  }, []);

  const fetchAlerts = useCallback(async (isCloud: boolean = false) => {
    try {
      if (isCloud) {
        // ✅ Call native Rust command
        const res: any[] = await invoke("cloud_get_proctoring_alerts");
        setProctoringAlerts(res);
        return;
      }

      const db = await getDb();
      const res = await db.select<ProctoringEvent[]>(`
        SELECT p.*, u.name as user_name
        FROM proctoring_events p
        JOIN users u ON p.user_id = u.id
        WHERE u.is_deleted = 0
        ORDER BY p.start_time DESC
        LIMIT 20
      `);
      setProctoringAlerts(res);
    } catch (e) {
      console.error("Failed to fetch alerts via Rust:", e);
    }
  }, []);

  const logSessionStart = async (userId: string) => {
    const id = crypto.randomUUID();
    let synced = 0;

    try {
      // ✅ Call native Rust command
      const result: any = await invoke("cloud_sync_post", { 
        collectionName: "sessions", 
        data: [{ id, user_id: userId, login_time: new Date().toISOString(), last_ping: new Date().toISOString(), logout_time: null }] 
      });
      if (result.success) synced = 1;
    } catch (e) {
      console.warn("Cloud session start failed via Rust, will sync later:", e);
    }

    await resilientExecute(
      "INSERT INTO sessions (id, user_id, login_time, last_ping, synced) VALUES ($1, $2, datetime('now'), datetime('now'), $3)",
      [id, userId, synced]
    );
    if (synced === 0) DataSyncService.triggerSync();
  };

  const logPing = async (userId: string) => {
    const db = await getDb();
    const active = await db.select<any[]>("SELECT id FROM sessions WHERE user_id = $1 AND logout_time IS NULL LIMIT 1", [userId]);
    if (active.length === 0) return;
    const sessionId = active[0].id;

    let synced = 0;
    try {
      const result: any = await invoke("cloud_sync_post", { 
        collectionName: "sessions", 
        data: [{ id: sessionId, last_ping: new Date().toISOString() }] 
      });
      if (result.success) synced = 1;
    } catch (e) { }

    await resilientExecute(
      "UPDATE sessions SET last_ping = datetime('now'), synced = $1 WHERE id = $2",
      [synced, sessionId]
    );
  };

  const logSessionEnd = async (userId: string) => {
    const db = await getDb();
    const active = await db.select<any[]>("SELECT id FROM sessions WHERE user_id = $1 AND logout_time IS NULL LIMIT 1", [userId]);
    if (active.length === 0) return;
    const sessionId = active[0].id;

    let synced = 0;
    const now = new Date().toISOString();
    try {
      const result: any = await invoke("cloud_sync_post", { 
        collectionName: "sessions", 
        data: [{ id: sessionId, logout_time: now }] 
      });
      if (result.success) synced = 1;
    } catch (e) { }

    await resilientExecute(
      "UPDATE sessions SET logout_time = datetime('now'), synced = $1 WHERE id = $2",
      [synced, sessionId]
    );
    if (synced === 0) DataSyncService.triggerSync();
  };

  const updateSessionStats = async (userId: string, stats: { keystrokes: number, faceMissingSeconds: number, activeSeconds: number, integrityScore: number }) => {
    try {
      const db = await getDb();
      const active = await db.select<any[]>("SELECT id, total_minutes, total_keystrokes, face_missing_duration FROM sessions WHERE user_id = $1 AND logout_time IS NULL LIMIT 1", [userId]);
      if (active.length === 0) return;
      const session = active[0];

      let synced = 0;
      try {
        const result: any = await invoke("cloud_sync_post", { 
          collectionName: "sessions", 
          data: [{ 
            id: session.id, 
            total_keystrokes: session.total_keystrokes + stats.keystrokes,
            face_missing_duration: session.face_missing_duration + stats.faceMissingSeconds,
            total_minutes: session.total_minutes + (stats.activeSeconds / 60.0),
            integrity_score: stats.integrityScore
          }] 
        });
        if (result.success) synced = 1;
      } catch (e) { }

      await resilientExecute(
        `UPDATE sessions 
         SET total_keystrokes = total_keystrokes + $1, 
             face_missing_duration = face_missing_duration + $2,
             total_minutes = total_minutes + ($3 / 60.0),
             integrity_score = $4,
             synced = $5 
         WHERE id = $6`,
        [stats.keystrokes, stats.faceMissingSeconds, stats.activeSeconds, stats.integrityScore, synced, session.id]
      );

      await resilientExecute(
        `UPDATE users 
         SET todayHours = todayHours + ($1 / 3600.0)
         WHERE id = $2`,
        [stats.activeSeconds, userId]
      );

      if (synced === 0) DataSyncService.triggerSync();
    } catch (e) {
      console.error("Failed to update session stats", e);
    }
  };

  const logProctoringEvent = async (userId: string, type: string, duration: number) => {
    const id = crypto.randomUUID();
    let synced = 0;
    const now = new Date().toISOString();

    try {
      const result: any = await invoke("cloud_sync_post", { 
        collectionName: "proctoring", 
        data: [{ id, user_id: userId, event_type: type, duration_seconds: duration, start_time: now }] 
      });
      if (result.success) synced = 1;
    } catch (e) { }

    await resilientExecute(
      "INSERT INTO proctoring_events (id, user_id, event_type, duration_seconds, synced, start_time) VALUES ($1, $2, $3, $4, $5, datetime('now'))",
      [id, userId, type, duration, synced]
    );
    fetchAlerts();
    if (synced === 0) DataSyncService.triggerSync();
  };

  const fetchAllUserStats = async (): Promise<any[]> => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>(`
        SELECT
          u.id, u.name, u.email, u.role, u.department, u.avatar, u.initials, u.status,
          COALESCE(SUM(s.total_minutes), 0)                          AS total_minutes,
          COALESCE(SUM(s.total_keystrokes), 0)                       AS total_keystrokes,
          COALESCE(SUM(s.face_missing_duration), 0)                  AS face_missing_duration,
          COALESCE(AVG(NULLIF(s.integrity_score, 0)), 100)           AS integrity_score,
          COUNT(DISTINCT s.id)                                        AS session_count,
          MIN(s.login_time)                                           AS first_login,
          MAX(s.last_ping)                                            AS last_seen,
          (SELECT COUNT(*) FROM proctoring_events p WHERE p.user_id = u.id) AS violations,
          (SELECT s2.logout_time IS NULL FROM sessions s2
           WHERE s2.user_id = u.id AND s2.logout_time IS NULL
           AND s2.last_ping > datetime('now', '-5 minutes')
           LIMIT 1)                                                   AS is_online
        FROM users u
        LEFT JOIN sessions s ON s.user_id = u.id
        WHERE u.role IN ('employee', 'manager')
        AND u.is_deleted = 0
        GROUP BY u.id
        ORDER BY u.role, u.name
      `);
      return res;
    } catch (e) {
      console.error("Failed to fetch all user stats", e);
      return [];
    }
  };

  return {
    activeSessions, proctoringAlerts, fetchActiveStatus, fetchAlerts, logSessionStart,
    logPing, logSessionEnd, logProctoringEvent, updateSessionStats, fetchAllUserStats
  };
}
