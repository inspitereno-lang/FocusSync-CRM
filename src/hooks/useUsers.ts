import { useState, useEffect, useCallback } from "react";
import { getDb, resilientExecute } from "@/services/db";
import { DataSyncService } from "@/services/syncService";
import { invoke } from "@tauri-apps/api/core";
import bcrypt from "bcryptjs";
import { useActivities } from "./useActivities";

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive" | "locked" | "away" | "offline";
  department: string;
  avatar: string;
  initials: string;
  focusScore?: number;
  integrityScore?: number;
  todayHours?: number;
  currentTask?: string;
  manager_id?: string | null;
}

export function useUsers() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { logActivity } = useActivities();

  // ✅ Stabilized with useCallback so parent useEffect deps don't re-trigger on re-renders
  const fetchUsers = useCallback(async (isCloud: boolean = false) => {
    try {
      if (isCloud) {
        // ✅ Call native Rust command
        const res: any[] = await invoke("cloud_sync_get", { collectionName: "users" });
        setUsers(res);
        return;
      }

      const db = await getDb();
      const res = await db.select<SystemUser[]>("SELECT * FROM users WHERE COALESCE(is_deleted, 0) = 0 ORDER BY id ASC");
      setUsers(res);
    } catch (e) {
      console.error("Failed to fetch users via Rust bridge:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  const addUser = async (user: Omit<SystemUser, "focusScore"|"todayHours"|"currentTask"> & { password?: string }) => {
    const userId = (user as any).id || crypto.randomUUID();
    let synced = 0;

    try {
      // ✅ Call native Rust command
      const result: any = await invoke("cloud_manage_users", { 
        action: "upsert", 
        user: { ...user, id: userId } 
      });
      if (result.success) synced = 1;
    } catch (e) {
      console.warn("Cloud add failed via Rust, will sync later:", e);
    }

    const db = await getDb();
    await resilientExecute(
      "INSERT INTO users (id, name, email, role, status, department, avatar, initials, password, manager_id, synced) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
      [
        userId, user.name, user.email, user.role, user.status, user.department, 
        user.avatar, user.initials, bcrypt.hashSync(user.password || "default123", 10), 
        (user as any).manager_id || null, synced
      ]
    );
    await fetchUsers();
    if (synced === 0) DataSyncService.triggerSync();
  };

  const updateUser = async (id: string, updates: Partial<SystemUser>) => {
    let synced = 0;

    try {
      // ✅ Call native Rust command
      const result: any = await invoke("cloud_manage_users", { 
        action: "upsert", 
        user: { id, ...updates } 
      });
      if (result.success) synced = 1;
    } catch (e) {
      console.warn("Cloud update failed via Rust, will sync later:", e);
    }

    const db = await getDb();
    const validCols = ['name', 'email', 'role', 'status', 'department', 'avatar', 'initials', 'password', 'manager_id', 'synced'];
    
    const dbUpdates: any = {};
    Object.keys(updates).forEach(key => {
      if (validCols.includes(key)) {
        let val = (updates as any)[key];
        if (key === 'password' && typeof val === 'string') {
          val = bcrypt.hashSync(val, 10);
        }
        dbUpdates[key] = val;
      }
    });

    if (Object.keys(dbUpdates).length === 0) return;

    const setCols = Object.keys(dbUpdates).map((k, i) => `${k} = $${i + 1}`).join(", ");
    const vals = Object.values(dbUpdates);

    await resilientExecute(`UPDATE users SET ${setCols}, synced = $${vals.length + 1}, updated_at = datetime('now') WHERE id = $${vals.length + 2}`, [...vals, synced, id]);
    await fetchUsers();
    if (synced === 0) DataSyncService.triggerSync();
  };

  const deleteUser = async (id: string) => {
    let synced = 0;

    try {
      // ✅ Call native Rust command
      const result: any = await invoke("cloud_manage_users", { action: "delete", user: { id } });
      if (result.success) synced = 1;
    } catch (e) {
      console.warn("Cloud delete failed via Rust, will sync later:", e);
    }

    const db = await getDb();
    await resilientExecute("UPDATE users SET manager_id = NULL, synced = $1 WHERE manager_id = $2", [synced, id]);
    await resilientExecute("UPDATE users SET is_deleted = 1, synced = $1, updated_at = datetime('now') WHERE id = $2", [synced, id]);
    
    await fetchUsers();
    if (synced === 0) DataSyncService.triggerSync();

    await logActivity({
      user_name: "Admin",
      user_id: "system",
      action: `deleted user: ${id}`,
      status: "online"
    });
  };

  return { users, loading, addUser, updateUser, deleteUser, refresh: fetchUsers };
}
