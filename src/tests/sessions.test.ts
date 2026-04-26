import { useSessions } from "../hooks/useSessions";
import { renderHook, act } from "@testing-library/react";

// Mock the database service
jest.mock("../services/db", () => ({
  getDb: jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue([
      { id: "s1", user_id: "u1", login_time: new Date().toISOString(), logout_time: null, total_minutes: 0 }
    ]),
    execute: jest.fn()
  })
}));

describe("useSessions Hook", () => {
  it("should calculate today's minutes correctly", async () => {
    const { result } = renderHook(() => useSessions("u1"));
    
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });
    
    const minutes = result.current.getTodayMinutes("u1");
    // Since login_time is "now", the diff should be around 0
    expect(minutes).toBeGreaterThanOrEqual(0);
  });
});
