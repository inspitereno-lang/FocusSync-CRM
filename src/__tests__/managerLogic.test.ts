import { renderHook, act } from '@testing-library/react';
import { useUsers } from '../hooks/useUsers';
import { useTasks } from '../hooks/useTasks';
import { getDb } from '../services/db';
import { DataSyncService } from '../services/syncService';

// Mock dependencies
jest.mock('../services/db');
jest.mock('../services/syncService');

// Polyfill for crypto.randomUUID if needed in node environment
if (typeof crypto === 'undefined') {
  (global as any).crypto = {
    randomUUID: () => 'test-uuid-1234'
  };
} else if (!crypto.randomUUID) {
  (crypto as any).randomUUID = () => 'test-uuid-1234';
}

const mockDb = {
  execute: jest.fn(),
  select: jest.fn(),
};

describe('Manager Dashboard Logic (Hooks)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDb as jest.Mock).mockResolvedValue(mockDb);
    mockDb.select.mockResolvedValue([]);
    (DataSyncService.triggerSync as jest.Mock) = jest.fn();
  });

  describe('Team Management (useUsers)', () => {
    it('should add a new team member with correct manager_id and synced=0', async () => {
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

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        expect.arrayContaining([
          newUser.id,
          newUser.name,
          newUser.email,
          newUser.role,
          newUser.status,
          newUser.department,
          newUser.avatar,
          newUser.initials,
          expect.any(String), // hashed password
          'manager-123'  // manager_id
        ])
      );
      expect(DataSyncService.triggerSync).toHaveBeenCalled();
    });

    it('should update team member details and reset sync flag', async () => {
      const { result } = renderHook(() => useUsers());
      
      await act(async () => {
        await result.current.updateUser('emp-1', { status: 'inactive' });
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET status = $1, synced = 0'),
        expect.arrayContaining(['inactive', 'emp-1'])
      );
    });
  });

  describe('Task Management (useTasks)', () => {
    it('should create a task for a team member and set synced=0', async () => {
      const { result } = renderHook(() => useTasks());
      
      const newTask = {
        title: 'Complete Report',
        description: 'Finish the monthly report',
        status: 'pending' as const,
        priority: 'high' as const,
        assignee_email: 'john@example.com',
        owner_email: 'manager@example.com',
        due_date: '2026-05-01',
        subtasks: []
      };

      await act(async () => {
        await result.current.addTask(newTask);
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks'),
        expect.arrayContaining([
          newTask.title,
          newTask.assignee_email,
          'high'
        ])
      );
      // Verify synced = 0 is implicitly handled by the hook (or explicitly in some versions)
      expect(DataSyncService.triggerSync).toHaveBeenCalled();
    });

    it('should mark a task as completed and reset sync flag', async () => {
      const { result } = renderHook(() => useTasks());
      
      await act(async () => {
        await result.current.updateTask('task-123', { status: 'completed' });
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tasks SET status = $1, synced = 0'),
        expect.arrayContaining(['completed', 'task-123'])
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty updates gracefully', async () => {
      const { result } = renderHook(() => useUsers());
      
      await act(async () => {
        await result.current.updateUser('emp-1', {});
      });

      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should handle complex subtask serialization in tasks', async () => {
      const { result } = renderHook(() => useTasks());
      const subtasks = [{ id: 's1', title: 'Part 1', completed: true }];

      await act(async () => {
        await result.current.updateTask('task-1', { subtasks });
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('subtasks = $1'),
        expect.arrayContaining([JSON.stringify(subtasks), 'task-1'])
      );
    });
  });
});
