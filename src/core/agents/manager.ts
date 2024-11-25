import { EventStore } from '../events/event-store';
import { EventType } from '../events/types';
import { ToolRegistry } from '../tools/registry';
import { ToolParams, ToolResult } from '../tools/types';
import { AgentConfig, AgentState, AgentStatus, AgentMetrics } from './types';
import { IAgentManager } from '../interfaces/agent';
import crypto from 'crypto';
import { NotificationService } from '../services/notification';

interface AgentEvent {
  id: string;
  type: EventType;
  agentId: string;
  data: Record<string, unknown>;
  metadata: {
    correlationId: string;
    timestamp: Date;
    version: string;
    environment: string;
  };
}

export class AgentManager implements IAgentManager {
  private agents: Map<string, AgentState> = new Map();
  private configs: Map<string, AgentConfig> = new Map();
  private metrics: Map<string, AgentMetrics> = new Map();

  constructor(
    private eventStore: EventStore,
    private toolRegistry: ToolRegistry,
    private notificationService: NotificationService
  ) {}

  async initialize(): Promise<void> {
    // Reconstruct state from events
    const events = await this.eventStore.getEvents('system');
    for (const event of events) {
      await this.applyEvent(event);
    }
  }

  async registerAgent(config: AgentConfig): Promise<void> {
    if (this.configs.has(config.id)) {
      throw new Error(`Agent ${config.id} already registered`);
    }

    const initialState: AgentState = {
      status: AgentStatus.IDLE,
      lastActivity: new Date(),
      errorCount: 0,
      assistanceCount: 0
    };

    const initialMetrics: AgentMetrics = {
      taskSuccessCount: 0,
      taskFailureCount: 0,
      averageTaskDuration: 0,
      toolUsageCount: {},
      assistanceRequestCount: 0
    };

    await this.eventStore.append({
      id: crypto.randomUUID(),
      agentId: config.id,
      type: EventType.AGENT_REGISTERED,
      data: {
        id: config.id,
        name: config.name,
        description: config.description,
        allowedTools: config.allowedTools,
        maxConcurrentTasks: config.maxConcurrentTasks,
        assistanceThreshold: config.assistanceThreshold
      },
      metadata: {
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });

    this.configs.set(config.id, config);
    this.agents.set(config.id, initialState);
    this.metrics.set(config.id, initialMetrics);
  }

  async getAgentState(agentId: string): Promise<AgentState> {
    const state = this.agents.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return state;
  }

  async requestAssistance(agentId: string, context: { reason: string }): Promise<void> {
    const state = await this.getAgentState(agentId);
    
    state.status = AgentStatus.WAITING_FOR_ASSISTANCE;
    state.assistanceCount++;
    
    await this.eventStore.append({
      id: crypto.randomUUID(),
      agentId,
      type: EventType.ASSISTANCE_REQUESTED,
      data: context,
      metadata: {
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });

    // Notify manager about assistance request
    await this.notificationService.alertManager({
      agentId,
      reason: context.reason,
      timestamp: new Date()
    });
  }

  async provideAssistance(agentId: string, response: Record<string, unknown>): Promise<void> {
    const state = await this.getAgentState(agentId);
    
    state.status = AgentStatus.RUNNING;
    
    await this.eventStore.append({
      id: crypto.randomUUID(),
      agentId,
      type: EventType.STATE_UPDATED,
      data: { response },
      metadata: {
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  }

  private async applyEvent(event: AgentEvent): Promise<void> {
    const handlers: Partial<Record<EventType, (event: AgentEvent) => Promise<void>>> = {
      [EventType.AGENT_STARTED]: this.handleAgentStarted.bind(this),
      [EventType.AGENT_STOPPED]: this.handleAgentStopped.bind(this),
      [EventType.STATE_UPDATED]: this.handleStateUpdated.bind(this),
      [EventType.TOOL_ACCESSED]: this.handleToolAccessed.bind(this),
      [EventType.ASSISTANCE_REQUESTED]: this.handleAssistanceRequested.bind(this),
      [EventType.TASK_COMPLETED]: this.handleTaskCompleted.bind(this),
      [EventType.ERROR_OCCURRED]: this.handleErrorOccurred.bind(this)
    };

    const handler = handlers[event.type];
    if (handler) {
      await handler(event);
    }
  }

  private async handleAgentStarted(event: AgentEvent): Promise<void> {
    const config = event.data.config as AgentConfig;
    if (!config || !config.id) {
      throw new Error('Invalid agent configuration in event data');
    }
    this.configs.set(config.id, config);
  }

  private async handleAgentStopped(event: AgentEvent): Promise<void> {
    const state = this.agents.get(event.agentId);
    if (state) {
      state.status = AgentStatus.STOPPED;
    }
  }

  private async handleStateUpdated(event: AgentEvent): Promise<void> {
    const state = this.agents.get(event.agentId);
    if (state) {
      Object.assign(state, event.data.state);
    }
  }

  private async handleAssistanceRequested(event: AgentEvent): Promise<void> {
    const state = this.agents.get(event.agentId);
    if (state) {
      state.status = AgentStatus.WAITING_FOR_ASSISTANCE;
      state.assistanceCount++;
    }
  }

  private async handleTaskCompleted(event: AgentEvent): Promise<void> {
    const metrics = this.metrics.get(event.agentId);
    if (metrics) {
      metrics.taskSuccessCount++;
    }
  }

  private async handleErrorOccurred(event: AgentEvent): Promise<void> {
    const state = this.agents.get(event.agentId);
    if (state) {
      state.status = AgentStatus.ERROR;
      state.errorCount++;
    }
  }

  private async handleToolAccessed(event: AgentEvent): Promise<void> {
    const metrics = this.metrics.get(event.agentId);
    if (metrics) {
      const toolId = event.data.toolId as string;
      metrics.toolUsageCount[toolId] = (metrics.toolUsageCount[toolId] || 0) + 1;
    }
  }

  async getAgentMetrics(agentId: string): Promise<AgentMetrics> {
    const metrics = this.metrics.get(agentId);
    if (!metrics) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return metrics;
  }

  async executeTool(agentId: string, toolId: string, params: ToolParams): Promise<ToolResult> {
    const state = await this.getAgentState(agentId);
    const config = this.configs.get(agentId);

    if (!config) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (!config.allowedTools.includes(toolId)) {
      throw new Error(`Tool ${toolId} not allowed for agent ${agentId}`);
    }

    if (state.status !== AgentStatus.RUNNING) {
      throw new Error(`Agent ${agentId} is not in running state`);
    }

    const tool = await this.toolRegistry.get(toolId);
    const result = await tool.execute(params);

    // Update metrics
    const metrics = this.metrics.get(agentId);
    if (metrics) {
      metrics.toolUsageCount[toolId] = (metrics.toolUsageCount[toolId] || 0) + 1;
    }

    // Log tool access event
    await this.eventStore.append({
      id: crypto.randomUUID(),
      agentId,
      type: EventType.TOOL_ACCESSED,
      data: { toolId, params, result },
      metadata: {
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
        version: '1.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });

    return result;
  }
} 