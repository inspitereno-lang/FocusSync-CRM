import { useTasks } from '../hooks/useTasks';
import { getDb } from '../services/db';
import { renderHook, act } from '@testing-library/react';

// Mock dependency modules
jest.mock('../services/db');
jest.mock('../services/syncService');

const mockDb = {
  execute: jest.fn(),
  select: jest.fn(),
};

describe('Task Management Hook Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDb as jest.Mock).mockResolvedValue(mockDb);
    mockDb.select.mockResolvedValue([]); // Default empty tasks
  });

  it('should update the synced flag to 0 when updating a task', async () => {
    const { result } = renderHook(() => useTasks());
    
    await act(async () => {
      await result.current.updateTask('test-id', { title: 'Updated Title' });
    });

    // Check if SQL query includes synced = 0
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining('SET title = $1, synced = 0'),
      expect.arrayContaining(['Updated Title', 'test-id'])
    );
  });

  it('should set is_deleted to 1 and synced to 0 when deleting a task', async () => {
    const { result } = renderHook(() => useTasks());
    
    await act(async () => {
      await result.current.deleteTask('delete-id');
    });

    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks SET is_deleted = 1, synced = 0'),
      ['delete-id']
    );
  });
});
