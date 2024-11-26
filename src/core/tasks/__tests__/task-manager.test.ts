import { TaskManager } from '../task-manager';
import { EventStore } from '../../events/event-store';
import { Agent } from '../../agent/agent';
import { TaskDefinition, TaskSchedule, RetryPolicy } from '../types';
import { EventType } from '../../events/types';

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let eventStore: EventStore;
  let agent: Agent;

  beforeEach(() => {
    // Mock EventStore
    eventStore = {
      append: jest.fn().mockResolvedValue(undefined),
      getEvents: jest.fn().mockResolvedValue([]),
      getSnapshot: jest.fn().mockResolvedValue(null),
      saveSnapshot: jest.fn().mockResolvedValue(undefined)
    } as unknown as EventStore;

    // Mock Agent
    agent = {
      getState: jest.fn().mockReturnValue({ id: 'test-agent', status: 'idle' }),
      executeTask: jest.fn().mockResolvedValue({ success: true, data: 'test result' })
    } as unknown as Agent;

    taskManager = new TaskManager(eventStore);
  });

  describe('registerTask', () => {
    it('should register a task definition', async () => {
      const definition: TaskDefinition = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        version: '1.0.0',
        toolRequirements: ['test-tool'],
        parameters: [
          {
            name: 'param1',
            type: 'string',
            description: 'Test parameter',
            required: true
          }
        ]
      };

      await taskManager.registerTask(definition);

      expect(eventStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventType.TASK_REGISTERED,
          data: { definition }
        })
      );
    });

    it('should prevent duplicate task registration', async () => {
      const definition: TaskDefinition = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        version: '1.0.0',
        toolRequirements: ['test-tool'],
        parameters: []
      };

      await taskManager.registerTask(definition);
      await expect(taskManager.registerTask(definition))
        .rejects
        .toThrow('Task definition test-task already exists');
    });
  });

  describe('scheduleTask', () => {
    const taskDefinition: TaskDefinition = {
      id: 'test-task',
      name: 'Test Task',
      description: 'A test task',
      version: '1.0.0',
      toolRequirements: ['test-tool'],
      parameters: []
    };

    beforeEach(async () => {
      await taskManager.registerTask(taskDefinition);
    });

    it('should schedule a task', async () => {
      const schedule: TaskSchedule = {
        taskId: 'test-task',
        agentId: 'test-agent',
        priority: 1,
        scheduledTime: new Date(),
        parameters: {},
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user'
        }
      };

      await taskManager.scheduleTask(schedule);

      expect(eventStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventType.TASK_SCHEDULED,
          data: { schedule }
        })
      );
    });

    it('should reject scheduling unknown task', async () => {
      const schedule: TaskSchedule = {
        taskId: 'unknown-task',
        agentId: 'test-agent',
        priority: 1,
        scheduledTime: new Date(),
        parameters: {},
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user'
        }
      };

      await expect(taskManager.scheduleTask(schedule))
        .rejects
        .toThrow('Task definition unknown-task not found');
    });
  });

  describe('processQueue', () => {
    const taskDefinition: TaskDefinition = {
      id: 'test-task',
      name: 'Test Task',
      description: 'A test task',
      version: '1.0.0',
      toolRequirements: ['test-tool'],
      parameters: [],
      retryPolicy: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
        maxDelay: 5000
      }
    };

    beforeEach(async () => {
      await taskManager.registerTask(taskDefinition);
    });

    it('should process a scheduled task', async () => {
      const schedule: TaskSchedule = {
        taskId: 'test-task',
        agentId: 'test-agent',
        priority: 1,
        scheduledTime: new Date(Date.now() - 1000), // Schedule in the past
        parameters: {},
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user'
        }
      };

      await taskManager.scheduleTask(schedule);
      await taskManager.processQueue(agent);

      expect(agent.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test-task',
          parameters: {}
        })
      );
    });

    it('should handle task failure and retry', async () => {
      const schedule: TaskSchedule = {
        taskId: 'test-task',
        agentId: 'test-agent',
        priority: 1,
        scheduledTime: new Date(Date.now() - 1000),
        parameters: {},
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user'
        }
      };

      (agent.executeTask as jest.Mock).mockRejectedValueOnce(new Error('Test error'));

      await taskManager.scheduleTask(schedule);
      await taskManager.processQueue(agent);

      expect(eventStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventType.TASK_FAILED,
          data: expect.objectContaining({
            willRetry: true
          })
        })
      );
    });

    it('should respect task dependencies', async () => {
      const dependentTask: TaskDefinition = {
        id: 'dependent-task',
        name: 'Dependent Task',
        description: 'A dependent task',
        version: '1.0.0',
        toolRequirements: ['test-tool'],
        parameters: []
      };

      await taskManager.registerTask(dependentTask);

      const schedule1: TaskSchedule = {
        taskId: 'test-task',
        agentId: 'test-agent',
        priority: 1,
        scheduledTime: new Date(Date.now() - 1000),
        parameters: {},
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user'
        }
      };

      const schedule2: TaskSchedule = {
        taskId: 'dependent-task',
        agentId: 'test-agent',
        priority: 1,
        scheduledTime: new Date(Date.now() - 1000),
        dependencies: ['test-task'],
        parameters: {},
        metadata: {
          createdAt: new Date(),
          createdBy: 'test-user'
        }
      };

      await taskManager.scheduleTask(schedule2);
      await taskManager.scheduleTask(schedule1);
      
      await taskManager.processQueue(agent);

      expect(agent.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test-task'
        })
      );

      expect(agent.executeTask).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dependent-task'
        })
      );
    });
  });
}); 