import { useState, useEffect } from "react";
import { getDb, resilientExecute } from "@/services/db";
import { DataSyncService } from "@/services/syncService";
import { invoke } from "@tauri-apps/api/core";

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  is_read: number;
}

export function useMessages(userId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    try {
      const db = await getDb();
      let query = "SELECT * FROM messages ORDER BY timestamp ASC";
      let params: any[] = [];
      
      if (userId) {
        query = "SELECT * FROM messages WHERE sender_id = $1 OR receiver_id = $1 ORDER BY timestamp ASC";
        params = [userId];
      }
      
      const res = await db.select<Message[]>(query, params);
      setMessages(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll more frequently for chat
    return () => clearInterval(interval);
  }, [userId]);

  const sendMessage = async (senderId: string, receiverId: string, content: string) => {
    const id = `msg-${Date.now()}`;
    let synced = 0;
    const now = new Date().toISOString();

    try {
      const result: any = await invoke("cloud_sync_post", { 
        collectionName: "messages", 
        data: [{ id, sender_id: senderId, receiver_id: receiverId, content, timestamp: now, is_read: 0 }] 
      });
      if (result.success) synced = 1;
    } catch (e) {
      console.warn("Cloud message send failed via Rust, will sync later:", e);
    }

    await resilientExecute(
      "INSERT INTO messages (id, sender_id, receiver_id, content, synced, timestamp) VALUES ($1, $2, $3, $4, $5, datetime('now'))",
      [id, senderId, receiverId, content, synced]
    );
    await fetchMessages();
    if (synced === 0) DataSyncService.triggerSync();
  };

  const markAsRead = async (messageId: string) => {
    let synced = 0;
    try {
      const result: any = await invoke("cloud_sync_post", { 
        collectionName: "messages", 
        data: [{ id: messageId, is_read: 1 }] 
      });
      if (result.success) synced = 1;
    } catch (e) { }

    await resilientExecute("UPDATE messages SET is_read = 1, synced = $1 WHERE id = $2", [synced, messageId]);
    await fetchMessages();
    if (synced === 0) DataSyncService.triggerSync();
  };

  return { messages, loading, sendMessage, markAsRead, refresh: fetchMessages };
}
