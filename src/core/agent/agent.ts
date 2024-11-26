import { EventStore } from '../events/event-store';
import { Tool, ToolResult } from '../tools/types';
import { AgentState, AgentConfig, TaskExecution, TaskResult, AgentStatus } from './types';
import { EventType } from '../events/types';

export class Agent {
  private state: AgentState;
  private readonly eventStore: EventStore;

  constructor(
    config: AgentConfig,
    eventStore: EventStore
  ) {
    this.eventStore = eventStore;
    this.state = {
      id: config.id,
      status: 'idle',
      tools: config.tools,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  }

  async executeTask(task: Omit<TaskExecution, 'status' | 'progress' | 'startedAt' | 'updatedAt'>): Promise<TaskResult> {
    if (this.state.status === 'executing') {
      throw new Error('Agent is already executing a task');
    }

    const taskExecution: TaskExecution = {
      ...task,
      status: 'running',
      progress: 0,
      startedAt: new Date(),
      updatedAt: new Date()
    };

    await this.updateState('executing', taskExecution);

    try {
      const tool = this.findToolForTask(task.type);
      if (!tool) {
        throw new Error(`No tool found for task type: ${task.type}`);
      }

      const result = await tool.execute({
        action: task.type,
        parameters: task.parameters
      });

      await this.handleTaskCompletion(taskExecution, result);
      return {
        success: result.success,
        data: result.data,
        error: result.error
      };
    } catch (error) {
      await this.handleTaskError(taskExecution, error as Error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async pause(): Promise<void> {
    if (this.state.status !== 'executing') {
      throw new Error('Agent is not executing');
    }
    await this.updateState('paused');
  }

  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new Error('Agent is not paused');
    }
    await this.updateState('executing');
  }

  async recover(): Promise<void> {
    if (this.state.status !== 'error') {
      throw new Error('Agent is not in error state');
    }
    await this.updateState('recovering');
    // TODO: Implement recovery logic based on strategy
    await this.updateState('idle');
  }

  getState(): AgentState {
    return { ...this.state };
  }

  private findToolForTask(taskType: string): Tool | undefined {
    return this.state.tools.find(tool => 
      tool.execute({ action: taskType, parameters: {} })
        .then(() => true)
        .catch(() => false)
    );
  }

  private async updateState(status: AgentStatus, task?: TaskExecution): Promise<void> {
    const previousState = { ...this.state };
    
    this.state = {
      ...this.state,
      status,
      currentTask: task || this.state.currentTask,
      metadata: {
        ...this.state.metadata,
        updatedAt: new Date(),
        lastActiveAt: new Date()
      }
    };

    await this.eventStore.append({
      id: crypto.randomUUID(),
      type: EventType.STATE_UPDATED,
      agentId: this.state.id,
      data: {
        previousState,
        newState: this.state
      },
      metadata: {
        timestamp: new Date(),
        correlationId: crypto.randomUUID(),
        version: '1.0.0',
        environment: 'development'
      }
    });
  }

  private async handleTaskCompletion(task: TaskExecution, result: ToolResult): Promise<void> {
    const completedTask: TaskExecution = {
      ...task,
      status: 'completed',
      progress: 100,
      result: {
        success: result.success,
        data: result.data,
        error: result.error
      },
      completedAt: new Date(),
      updatedAt: new Date()
    };

    await this.updateState('idle', completedTask);
  }

  private async handleTaskError(task: TaskExecution, error: Error): Promise<void> {
    const failedTask: TaskExecution = {
      ...task,
      status: 'failed',
      error,
      updatedAt: new Date()
    };

    await this.updateState('error', failedTask);
  }
} 