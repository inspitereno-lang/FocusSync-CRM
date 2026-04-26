import { useTasks } from '../hooks/useTasks';
import { renderHook, act } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';

// Mock dependency modules
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('../hooks/useActivities', () => ({
  useActivities: () => ({
    logActivity: jest.fn(),
  }),
}));

describe('Task Management Hook Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (invoke as jest.Mock).mockResolvedValue([]); // Default empty tasks for cloud_sync_get
  });

  it('should call cloud_sync_upsert when adding a task', async () => {
    const { result } = renderHook(() => useTasks());
    
    const newTask = {
      title: 'New Task',
      status: 'pending' as const,
      focus_time: 0,
      priority: 'medium' as const,
      assignee_email: 'test@example.com',
      owner_email: 'manager@example.com',
      due_date: null,
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
        id: expect.any(String),
        data: expect.objectContaining({ title: 'New Task' }),
      })
    );
  });

  it('should call cloud_sync_upsert when updating a task', async () => {
    const { result } = renderHook(() => useTasks());
    
    await act(async () => {
      await result.current.updateTask('test-id', { title: 'Updated Title' });
    });

    expect(invoke).toHaveBeenCalledWith(
      'cloud_sync_upsert',
      expect.objectContaining({
        collectionName: 'tasks',
        id: 'test-id',
        data: { title: 'Updated Title' },
      })
    );
  });

  it('should call cloud_sync_delete when deleting a task', async () => {
    const { result } = renderHook(() => useTasks());
    
    await act(async () => {
      await result.current.deleteTask('delete-id');
    });

    expect(invoke).toHaveBeenCalledWith(
      'cloud_sync_delete',
      { collectionName: 'tasks', id: 'delete-id' }
    );
  });
});
