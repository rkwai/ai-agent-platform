import { EventStore } from '../events/event-store';
import { EventType } from '../events/types';
import { TaskDefinition, TaskSchedule, TaskQueue, QueuedTask, QueueStatus } from './types';
import { Agent } from '../agent/agent';

export class TaskManager {
  private readonly queues: Map<string, TaskQueue>;
  private readonly definitions: Map<string, TaskDefinition>;
  private readonly eventStore: EventStore;

  constructor(eventStore: EventStore) {
    this.queues = new Map();
    this.definitions = new Map();
    this.eventStore = eventStore;
  }

  async registerTask(definition: TaskDefinition): Promise<void> {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Task definition ${definition.id} already exists`);
    }

    this.definitions.set(definition.id, definition);
    await this.eventStore.append({
      id: crypto.randomUUID(),
      type: EventType.TASK_REGISTERED,
      agentId: 'system',
      data: { definition },
      metadata: {
        timestamp: new Date(),
        correlationId: crypto.randomUUID(),
        version: '1.0.0',
        environment: 'development'
      }
    });
  }

  async scheduleTask(schedule: TaskSchedule): Promise<void> {
    const definition = this.definitions.get(schedule.taskId);
    if (!definition) {
      throw new Error(`Task definition ${schedule.taskId} not found`);
    }

    const queuedTask: QueuedTask = {
      schedule,
      status: 'pending',
      attempts: 0
    };

    let queue = this.queues.get(schedule.agentId);
    if (!queue) {
      queue = {
        id: schedule.agentId,
        name: `Agent ${schedule.agentId} Queue`,
        tasks: [],
        concurrencyLimit: 1,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
      this.queues.set(schedule.agentId, queue);
    }

    queue.tasks.push(queuedTask);
    queue.metadata.updatedAt = new Date();

    await this.eventStore.append({
      id: crypto.randomUUID(),
      type: EventType.TASK_SCHEDULED,
      agentId: schedule.agentId,
      data: { schedule },
      metadata: {
        timestamp: new Date(),
        correlationId: crypto.randomUUID(),
        version: '1.0.0',
        environment: 'development'
      }
    });
  }

  async processQueue(agent: Agent): Promise<void> {
    const queue = this.queues.get(agent.getState().id);
    if (!queue) return;

    const now = new Date();
    const readyTasks = queue.tasks.filter(task => 
      task.status === 'pending' &&
      task.schedule.scheduledTime <= now &&
      this.areDependenciesMet(task, queue)
    );

    if (readyTasks.length === 0) return;

    // Sort by priority and scheduled time
    readyTasks.sort((a, b) => {
      if (a.schedule.priority !== b.schedule.priority) {
        return b.schedule.priority - a.schedule.priority;
      }
      return a.schedule.scheduledTime.getTime() - b.schedule.scheduledTime.getTime();
    });

    const task = readyTasks[0];
    await this.executeTask(agent, task);
  }

  private async executeTask(agent: Agent, task: QueuedTask): Promise<void> {
    const definition = this.definitions.get(task.schedule.taskId);
    if (!definition) {
      throw new Error(`Task definition ${task.schedule.taskId} not found`);
    }

    try {
      task.status = 'executing';
      task.lastAttempt = new Date();
      task.attempts++;

      if (definition.validation?.preconditions) {
        for (const precondition of definition.validation.preconditions) {
          if (!await precondition.check(task.schedule.parameters)) {
            throw new Error(`Precondition failed: ${precondition.message}`);
          }
        }
      }

      const result = await agent.executeTask({
        id: crypto.randomUUID(),
        type: task.schedule.taskId,
        parameters: task.schedule.parameters
      });

      if (definition.validation?.postconditions) {
        for (const postcondition of definition.validation.postconditions) {
          if (!await postcondition.check(result)) {
            throw new Error(`Postcondition failed: ${postcondition.message}`);
          }
        }
      }

      task.status = 'completed';
      await this.eventStore.append({
        id: crypto.randomUUID(),
        type: EventType.TASK_COMPLETED,
        agentId: agent.getState().id,
        data: { taskId: task.schedule.taskId, result },
        metadata: {
          timestamp: new Date(),
          correlationId: crypto.randomUUID(),
          version: '1.0.0',
          environment: 'development'
        }
      });
    } catch (error) {
      task.status = this.shouldRetry(task, definition) ? 'retrying' : 'failed';
      if (task.status === 'retrying') {
        task.nextAttempt = this.calculateNextAttempt(task, definition);
      }

      await this.eventStore.append({
        id: crypto.randomUUID(),
        type: EventType.TASK_FAILED,
        agentId: agent.getState().id,
        data: { 
          taskId: task.schedule.taskId,
          error: error instanceof Error ? error.message : 'Unknown error',
          willRetry: task.status === 'retrying'
        },
        metadata: {
          timestamp: new Date(),
          correlationId: crypto.randomUUID(),
          version: '1.0.0',
          environment: 'development'
        }
      });
    }
  }

  private areDependenciesMet(task: QueuedTask, queue: TaskQueue): boolean {
    if (!task.schedule.dependencies?.length) return true;

    return task.schedule.dependencies.every(depId => {
      const depTask = queue.tasks.find(t => t.schedule.taskId === depId);
      return depTask?.status === 'completed';
    });
  }

  private shouldRetry(task: QueuedTask, definition: TaskDefinition): boolean {
    if (!definition.retryPolicy) return false;
    return task.attempts < definition.retryPolicy.maxAttempts;
  }

  private calculateNextAttempt(task: QueuedTask, definition: TaskDefinition): Date {
    if (!definition.retryPolicy) {
      throw new Error('No retry policy defined');
    }

    const { initialDelay, backoffMultiplier, maxDelay } = definition.retryPolicy;
    const delay = Math.min(
      initialDelay * Math.pow(backoffMultiplier, task.attempts - 1),
      maxDelay
    );

    return new Date(Date.now() + delay);
  }
} 