import { renderHook, act } from '@testing-library/react';
import { useUsers } from '../hooks/useUsers';
import { useTasks } from '../hooks/useTasks';
import { invoke } from '@tauri-apps/api/core';

// Mock dependencies
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('../hooks/useActivities', () => ({
  useActivities: () => ({
    logActivity: jest.fn(),
  }),
}));

// Polyfill for crypto.randomUUID if needed in node environment
if (typeof crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: () => 'test-uuid-1234'
  };
} else if (!crypto.randomUUID) {
  (crypto as any).randomUUID = () => 'test-uuid-1234';
}

describe('Manager Dashboard Logic (Hooks)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (invoke as jest.Mock).mockResolvedValue([]);
  });

  describe('Team Management (useUsers)', () => {
    it('should add a new team member via cloud_sync_upsert', async () => {
      const { result } = renderHook(() => useUsers());
      
      const newUser = {
        id: 'emp-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'employee',
        status: 'active' as const,
        department: 'Engineering',
        avatar: '#000',
        initials: 'JD',
        manager_id: 'manager-123'
      };

      await act(async () => {
        await result.current.addUser(newUser);
      });

      expect(invoke).toHaveBeenCalledWith(
        'cloud_sync_upsert',
        expect.objectContaining({
          collectionName: 'users',
          id: 'emp-1',
          data: expect.objectContaining({
            name: 'John Doe',
            password: expect.any(String), // hashed password
          })
        })
      );
    });

    it('should update team member details via cloud_sync_upsert', async () => {
      const { result } = renderHook(() => useUsers());
      
      await act(async () => {
        await result.current.updateUser('emp-1', { status: 'inactive' });
      });

      expect(invoke).toHaveBeenCalledWith(
        'cloud_sync_upsert',
        expect.objectContaining({
          collectionName: 'users',
          id: 'emp-1',
          data: { status: 'inactive' }
        })
      );
    });
  });

  describe('Task Management (useTasks)', () => {
    it('should create a task for a team member via cloud_sync_upsert', async () => {
      const { result } = renderHook(() => useTasks());
      
      const newTask = {
        title: 'Complete Report',
        description: 'Finish the monthly report',
        status: 'pending' as const,
        focus_time: 0,
        priority: 'high' as const,
        assignee_email: 'john@example.com',
        owner_email: 'manager@example.com',
        due_date: '2026-05-01',
        subtasks: [],
        started_at: null,
        is_running: false,
      };

      await act(async () => {
        await result.current.addTask(newTask);
      });

      expect(invoke).toHaveBeenCalledWith(
        'cloud_sync_upsert',
        expect.objectContaining({
          collectionName: 'tasks',
          data: expect.objectContaining({
            title: 'Complete Report',
            assignee_email: 'john@example.com'
          })
        })
      );
    });

    it('should mark a task as completed via cloud_sync_upsert', async () => {
      const { result } = renderHook(() => useTasks());
      
      await act(async () => {
        await result.current.updateTask('task-123', { status: 'completed' });
      });

      expect(invoke).toHaveBeenCalledWith(
        'cloud_sync_upsert',
        expect.objectContaining({
          collectionName: 'tasks',
          id: 'task-123',
          data: expect.objectContaining({ status: 'completed' })
        })
      );
    });
  });
});
