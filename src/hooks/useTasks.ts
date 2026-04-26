import { useState, useEffect, useCallback } from "react";
import { getDb, resilientExecute } from "@/services/db";
import { DataSyncService } from "@/services/syncService";
import { invoke } from "@tauri-apps/api/core";
import { useActivities } from "./useActivities";

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  assignee_email?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "completed";
  focus_time: number;
  priority: "high" | "medium" | "low";
  assignee_email: string | null;
  owner_email: string | null;
  due_date: string | null;
  subtasks: SubTask[];
  started_at: string | null;
  is_running: boolean;
  created_at?: string;
  updated_at?: string;
  completion_notes?: string;
  has_issue?: boolean;
  issue_description?: string;
}

export function useTasks(emailFilter?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { logActivity } = useActivities();

  // ✅ Stabilized with useCallback so parent useEffect deps don't re-trigger on re-renders
  const fetchTasks = useCallback(async (isCloud: boolean = false) => {
    try {
      if (isCloud) {
        // ✅ Call native Rust command
        const res: any[] = await invoke("cloud_sync_get", { collectionName: "tasks" });
        const safeParse = (val: any) => {
          if (!val) return [];
          if (typeof val !== 'string') return Array.isArray(val) ? val : [];
          try { return JSON.parse(val); } catch { return []; }
        };
        const parsedCloudTasks: Task[] = res.map((t: any) => ({
          ...t,
          subtasks: safeParse(t.subtasks),
          is_running: !!t.is_running
        }));
        setTasks(parsedCloudTasks);
        return;
      }

      const db = await getDb();
      let res: any[];
      if (emailFilter) {
        res = await db.select<any[]>("SELECT * FROM tasks WHERE assignee_email = $1 AND COALESCE(is_deleted, 0) = 0 ORDER BY updated_at DESC", [emailFilter]);
      } else {
        res = await db.select<any[]>("SELECT * FROM tasks WHERE COALESCE(is_deleted, 0) = 0 ORDER BY updated_at DESC");
      }
      
      const safeParse = (val: any) => {
        if (!val) return [];
        if (typeof val !== 'string') return Array.isArray(val) ? val : [];
        try { return JSON.parse(val); } catch { return []; }
      };

      const parsedTasks: Task[] = res.map(t => ({
        ...t,
        subtasks: safeParse(t.subtasks),
        is_running: !!t.is_running
      }));
      setTasks(parsedTasks);
    } catch (e) {
      console.error("Failed to fetch tasks via Rust bridge:", e);
    } finally {
      setLoading(false);
    }
  }, [emailFilter]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const addTask = async (task: Omit<Task, "id">) => {
    const id = crypto.randomUUID();
    let synced = 0;

    try {
      // ✅ Call native Rust command
      const result: any = await invoke("cloud_manage_tasks", { 
        action: "upsert", 
        task: { id, ...task } 
      });
      if (result.success) synced = 1;
    } catch (e) {
      console.warn("Cloud add failed via Rust, will sync later:", e);
    }

    const db = await getDb();
    await resilientExecute(
      "INSERT INTO tasks (id, title, description, status, focus_time, priority, assignee_email, owner_email, due_date, subtasks, created_at, updated_at, synced) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, datetime('now'), datetime('now'), $11)",
      [
        id, task.title, task.description || "", task.status, task.focus_time || 0, 
        task.priority, task.assignee_email, task.owner_email, task.due_date, 
        JSON.stringify(task.subtasks || []), synced
      ]
    );
    
    await fetchTasks();
    if (synced === 0) DataSyncService.triggerSync();
    
    await logActivity({
      user_name: task.owner_email?.split('@')[0] || "Manager",
      user_id: task.owner_email || "system",
      action: `created task: "${task.title}"`,
      status: "online"
    });
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    let synced = 0;

    try {
      // ✅ Call native Rust command
      const result: any = await invoke("cloud_manage_tasks", { 
        action: "upsert", 
        task: { id, ...updates } 
      });
      if (result.success) synced = 1;
    } catch (e) {
      console.warn("Cloud update failed via Rust, will sync later:", e);
    }

    const db = await getDb();
    const validCols = [
      'title', 'description', 'status', 'focus_time', 'priority', 
      'assignee_email', 'owner_email', 'due_date', 'subtasks', 
      'started_at', 'is_running', 'synced', 'completion_notes', 
      'has_issue', 'issue_description'
    ];
    
    const dbUpdates: any = {};
    Object.keys(updates).forEach(key => {
      if (validCols.includes(key)) {
        let val = (updates as any)[key];
        if (key === 'subtasks' && Array.isArray(val)) {
          val = JSON.stringify(val);
        }
        if (key === 'is_running' || key === 'has_issue') {
          val = val ? 1 : 0;
        }
        dbUpdates[key] = val;
      }
    });

    if (Object.keys(dbUpdates).length === 0 && updates.status === undefined) return;

    const setCols = Object.keys(dbUpdates).map((k, i) => `${k} = $${i + 1}`).join(", ");
    const vals = Object.values(dbUpdates);
    
    await resilientExecute(`UPDATE tasks SET ${setCols}, synced = $${vals.length + 1}, updated_at = datetime('now') WHERE id = $${vals.length + 2}`, [...vals, synced, id]);
    
    await fetchTasks();
    if (synced === 0) DataSyncService.triggerSync();

    if (updates.status === "completed") {
      await logActivity({
        user_name: updates.assignee_email?.split('@')[0] || "User",
        user_id: updates.assignee_email || "system",
        action: `completed task: "${updates.title || id}"`,
        status: "online"
      });
    }
  };

  const deleteTask = async (id: string) => {
    let synced = 0;

    try {
      // ✅ Call native Rust command
      const result: any = await invoke("cloud_manage_tasks", { action: "delete", task: { id } });
      if (result.success) synced = 1;
    } catch (e) {
      console.warn("Cloud delete failed via Rust, will sync later:", e);
    }

    const db = await getDb();
    await resilientExecute("UPDATE tasks SET is_deleted = 1, synced = $1, updated_at = datetime('now') WHERE id = $2", [synced, id]);
    await fetchTasks();
    if (synced === 0) DataSyncService.triggerSync();
  };

  return { tasks, loading, addTask, updateTask, deleteTask, refresh: fetchTasks };
}
