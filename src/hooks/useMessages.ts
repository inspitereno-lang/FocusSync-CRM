import { useState, useEffect, useCallback } from "react";
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

  const fetchMessages = useCallback(async () => {
    try {
      // Fetch messages involving this user
      const filter = userId ? {
        "$or": [
          { sender_id: userId },
          { receiver_id: userId }
        ]
      } : undefined;

      const res: any[] = await invoke("cloud_sync_get", { 
        collectionName: "messages", 
        filter 
      });
      
      const sorted = res.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(sorted);
    } catch (e) {
      console.error("Failed to fetch messages from MongoDB:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll for chat
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const sendMessage = async (senderId: string, receiverId: string, content: string) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newMessage = {
      id,
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      timestamp: now,
      is_read: 0
    };

    try {
      await invoke("cloud_sync_upsert", { 
        collectionName: "messages",
        id,
        data: newMessage 
      });
      setMessages(prev => [...prev, newMessage as Message]);
    } catch (e) {
      console.error("Failed to send message to MongoDB:", e);
      throw e;
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await invoke("cloud_sync_upsert", {
        collectionName: "messages",
        id: messageId,
        data: { is_read: 1 }
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_read: 1 } : m));
    } catch (e) {
      console.error("Failed to mark message as read in MongoDB:", e);
    }
  };

  return { messages, loading, sendMessage, markAsRead, refresh: fetchMessages };
}
