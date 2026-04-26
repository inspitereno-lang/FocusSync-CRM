import { useMessages } from "../hooks/useMessages";
import { renderHook, act } from "@testing-library/react";

// Mock the database service
jest.mock("../services/db", () => ({
  getDb: jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue([
      { id: "msg-1", sender_id: "u1", receiver_id: "u2", content: "Hello", timestamp: "2026-04-25T10:00:00Z", is_read: 0 }
    ]),
    execute: jest.fn().mockResolvedValue({ rowsAffected: 1 })
  })
}));

// Mock the sync service
jest.mock("../services/syncService", () => ({
  DataSyncService: {
    triggerSync: jest.fn()
  }
}));

describe("useMessages Hook", () => {
  it("should fetch messages on mount", async () => {
    const { result } = renderHook(() => useMessages("u1"));
    
    // Initial loading state
    expect(result.current.loading).toBe(true);
    
    // Wait for the mock to resolve
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });
    
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("Hello");
    expect(result.current.loading).toBe(false);
  });

  it("should send a message correctly", async () => {
    const { result } = renderHook(() => useMessages("u1"));
    
    await act(async () => {
      await result.current.sendMessage("u1", "u2", "New message");
    });

    const { getDb } = require("../services/db");
    const db = await getDb();
    
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO messages"),
      expect.arrayContaining(["u1", "u2", "New message"])
    );
  });
});
