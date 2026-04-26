import { useState, useEffect, useCallback } from "react";
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

  const fetchTasks = useCallback(async () => {
    try {
      const filter = emailFilter ? { assignee_email: emailFilter } : undefined;
      const res: any[] = await invoke("cloud_sync_get", { collectionName: "tasks", filter });
      
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
      console.error("Failed to fetch tasks from MongoDB:", e);
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
    try {
      await invoke("cloud_sync_upsert", { 
        collectionName: "tasks",
        id,
        data: { ...task, id, created_at: new Date().toISOString() } 
      });
      await fetchTasks();
      
      await logActivity({
        user_name: task.owner_email?.split('@')[0] || "Manager",
        user_id: task.owner_email || "system",
        action: `created task: "${task.title}"`,
        status: "online"
      });
    } catch (e) {
      console.error("Failed to add task to MongoDB:", e);
      throw e;
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      await invoke("cloud_sync_upsert", { 
        collectionName: "tasks",
        id,
        data: updates 
      });
      await fetchTasks();

      if (updates.status === "completed") {
        await logActivity({
          user_name: updates.assignee_email?.split('@')[0] || "User",
          user_id: updates.assignee_email || "system",
          action: `completed task: "${updates.title || id}"`,
          status: "online"
        });
      }
    } catch (e) {
      console.error("Failed to update task in MongoDB:", e);
      throw e;
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await invoke("cloud_sync_delete", { collectionName: "tasks", id });
      await fetchTasks();
    } catch (e) {
      console.error("Failed to delete task from MongoDB:", e);
      throw e;
    }
  };

  return { tasks, loading, addTask, updateTask, deleteTask, refresh: fetchTasks };
}
