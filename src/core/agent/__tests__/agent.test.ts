import { Agent } from '../agent';
import { EventStore } from '../../events/event-store';
import { Tool, ToolParams, ToolResult } from '../../tools/types';
import { AgentConfig, TaskExecution } from '../types';
import { EventType } from '../../events/types';

// Mock Tool implementation
class MockTool implements Tool {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly version: string,
    private readonly mockExecute: (params: ToolParams) => Promise<ToolResult>
  ) {}

  async configure(): Promise<void> {}
  async validate(): Promise<boolean> { return true; }
  async handleError(): Promise<void> {}
  async execute(params: ToolParams): Promise<ToolResult> {
    return this.mockExecute(params);
  }
}

describe('Agent', () => {
  let agent: Agent;
  let eventStore: EventStore;
  let mockTool: Tool;

  beforeEach(() => {
    // Mock EventStore
    eventStore = {
      append: jest.fn().mockImplementation(event => {
        expect(event).toMatchObject({
          id: expect.any(String),
          type: expect.any(String),
          agentId: 'test-agent',
          data: expect.any(Object),
          metadata: expect.objectContaining({
            timestamp: expect.any(Date),
            correlationId: expect.any(String)
          })
        });
        return Promise.resolve();
      }),
      getEvents: jest.fn().mockResolvedValue([]),
      getSnapshot: jest.fn().mockResolvedValue(null),
      saveSnapshot: jest.fn().mockResolvedValue(undefined)
    } as unknown as EventStore;

    // Mock Tool
    mockTool = new MockTool(
      'mock-tool',
      'Mock Tool',
      '1.0.0',
      jest.fn().mockResolvedValue({ success: true, data: 'mock result' })
    );

    // Create Agent
    const config: AgentConfig = {
      id: 'test-agent',
      tools: [mockTool]
    };
    agent = new Agent(config, eventStore);
  });

  describe('executeTask', () => {
    it('should execute a task successfully', async () => {
      const task: Omit<TaskExecution, 'status' | 'progress' | 'startedAt' | 'updatedAt'> = {
        id: 'task-1',
        type: 'mockAction',
        parameters: { key: 'value' }
      };

      const result = await agent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.data).toBe('mock result');
      expect(eventStore.append).toHaveBeenCalledTimes(2); // State changes: executing -> idle
      
      const state = agent.getState();
      expect(state.status).toBe('idle');
      expect(state.currentTask?.status).toBe('completed');
    });

    it('should handle task execution failure', async () => {
      const errorMessage = 'Task execution failed';
      mockTool = new MockTool(
        'mock-tool',
        'Mock Tool',
        '1.0.0',
        jest.fn().mockRejectedValue(new Error(errorMessage))
      );

      agent = new Agent({ id: 'test-agent', tools: [mockTool] }, eventStore);

      const task: Omit<TaskExecution, 'status' | 'progress' | 'startedAt' | 'updatedAt'> = {
        id: 'task-1',
        type: 'mockAction',
        parameters: { key: 'value' }
      };

      const result = await agent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(eventStore.append).toHaveBeenCalledTimes(2); // State changes: executing -> error
      
      const state = agent.getState();
      expect(state.status).toBe('error');
      expect(state.currentTask?.status).toBe('failed');
    });

    it('should prevent concurrent task execution', async () => {
      const task: Omit<TaskExecution, 'status' | 'progress' | 'startedAt' | 'updatedAt'> = {
        id: 'task-1',
        type: 'mockAction',
        parameters: { key: 'value' }
      };

      // Start first task (don't await)
      const firstTask = agent.executeTask(task);
      
      // Try to start second task
      await expect(agent.executeTask(task))
        .rejects
        .toThrow('Agent is already executing a task');

      // Complete first task
      await firstTask;
    });

    it('should emit state change events', async () => {
      const task: Omit<TaskExecution, 'status' | 'progress' | 'startedAt' | 'updatedAt'> = {
        id: 'task-1',
        type: 'mockAction',
        parameters: { key: 'value' }
      };

      await agent.executeTask(task);

      expect(eventStore.append).toHaveBeenCalledTimes(2);
      expect(eventStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventType.STATE_UPDATED,
          agentId: 'test-agent',
          data: expect.objectContaining({
            previousState: expect.any(Object),
            newState: expect.any(Object)
          })
        })
      );
    });
  });

  describe('pause/resume', () => {
    it('should pause and resume execution', async () => {
      // Create a delayed mock tool
      const delayedMockTool = new MockTool(
        'mock-tool',
        'Mock Tool',
        '1.0.0',
        jest.fn().mockImplementation(() => new Promise(resolve => {
          setTimeout(() => {
            resolve({ success: true, data: 'mock result' });
          }, 100);
        }))
      );

      agent = new Agent({ id: 'test-agent', tools: [delayedMockTool] }, eventStore);

      // Start a task
      const task: Omit<TaskExecution, 'status' | 'progress' | 'startedAt' | 'updatedAt'> = {
        id: 'task-1',
        type: 'mockAction',
        parameters: { key: 'value' }
      };

      // Start task execution
      const taskPromise = agent.executeTask(task);
      
      // Wait a bit to ensure task started
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Pause
      await agent.pause();
      expect(agent.getState().status).toBe('paused');

      // Resume
      await agent.resume();
      expect(agent.getState().status).toBe('executing');

      // Complete task
      await taskPromise;
      expect(agent.getState().status).toBe('idle');
    });

    it('should throw error when pausing non-executing agent', async () => {
      await expect(agent.pause())
        .rejects
        .toThrow('Agent is not executing');
    });

    it('should throw error when resuming non-paused agent', async () => {
      await expect(agent.resume())
        .rejects
        .toThrow('Agent is not paused');
    });
  });

  describe('recover', () => {
    it('should recover from error state', async () => {
      // Force agent into error state
      mockTool = new MockTool(
        'mock-tool',
        'Mock Tool',
        '1.0.0',
        jest.fn().mockRejectedValue(new Error('Forced error'))
      );
      agent = new Agent({ id: 'test-agent', tools: [mockTool] }, eventStore);

      const task: Omit<TaskExecution, 'status' | 'progress' | 'startedAt' | 'updatedAt'> = {
        id: 'task-1',
        type: 'mockAction',
        parameters: { key: 'value' }
      };

      await agent.executeTask(task);
      expect(agent.getState().status).toBe('error');

      // Recover
      await agent.recover();
      expect(agent.getState().status).toBe('idle');
    });

    it('should throw error when recovering non-error state', async () => {
      await expect(agent.recover())
        .rejects
        .toThrow('Agent is not in error state');
    });
  });
}); 