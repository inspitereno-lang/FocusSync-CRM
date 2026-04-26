import { useState, useEffect, useCallback } from "react";
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
  password?: string;
}

export function useUsers() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { logActivity } = useActivities();

  const fetchUsers = useCallback(async () => {
    try {
      // ✅ Fetch directly from MongoDB
      const res: any[] = await invoke("cloud_sync_get", { collectionName: "users" });
      setUsers(res);
    } catch (e) {
      console.error("Failed to fetch users from MongoDB:", e);
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
    const passwordHash = bcrypt.hashSync(user.password || "default123", 10);

    try {
      await invoke("cloud_sync_upsert", { 
        collectionName: "users",
        id: userId,
        data: { ...user, id: userId, password: passwordHash } 
      });
      await fetchUsers();
    } catch (e) {
      console.error("Failed to add user to MongoDB:", e);
      throw e;
    }
  };

  const updateUser = async (id: string | number, updates: Partial<SystemUser>) => {
    try {
      if (updates.password) {
        updates.password = bcrypt.hashSync(updates.password, 10) as any;
      }
      await invoke("cloud_sync_upsert", { 
        collectionName: "users",
        id: id.toString(),
        data: updates 
      });
      await fetchUsers();
    } catch (e) {
      console.error("Failed to update user in MongoDB:", e);
      throw e;
    }
  };

  const deleteUser = async (id: string | number) => {
    try {
      await invoke("cloud_sync_delete", { collectionName: "users", id: id.toString() });
      await fetchUsers();
      
      await logActivity({
        user_name: "Admin",
        user_id: "system",
        action: `deleted user: ${id}`,
        status: "online"
      });
    } catch (e) {
      console.error("Failed to delete user from MongoDB:", e);
      throw e;
    }
  };

  return { users, loading, addUser, updateUser, deleteUser, refresh: fetchUsers };
}
