import { IAgentManager } from '../interfaces/agent';
import { IToolRegistry } from '../interfaces/tool';
import { IEventStore } from '../interfaces/event';
import { AgentConfig, AgentState, AgentMetrics } from '../agents/types';
import { ToolParams } from '../tools/types';

export class AgentOrchestrator {
  constructor(
    private readonly agentManager: IAgentManager,
    private readonly toolRegistry: IToolRegistry,
    private readonly eventStore: IEventStore
  ) {}

  async createAgent(config: AgentConfig): Promise<void> {
    await this.agentManager.registerAgent(config);
  }

  async executeAgentTask(
    agentId: string,
    toolId: string,
    params: ToolParams
  ): Promise<void> {
    const state = await this.agentManager.getAgentState(agentId);
    const config = await this.getAgentConfig(agentId);

    if (!config.allowedTools.includes(toolId)) {
      throw new Error(`Tool ${toolId} not allowed for agent ${agentId}`);
    }

    if (state.status !== 'RUNNING') {
      throw new Error(`Agent ${agentId} is not in running state`);
    }

    await this.agentManager.executeTool(agentId, toolId, params);
  }

  async handleAssistanceRequest(
    agentId: string,
    context: Record<string, unknown>
  ): Promise<void> {
    await this.agentManager.requestAssistance(agentId, context);
    // Additional logic for notifying managers could go here
  }

  async provideAssistance(
    agentId: string,
    response: Record<string, unknown>
  ): Promise<void> {
    await this.agentManager.provideAssistance(agentId, response);
  }

  async getAgentState(agentId: string): Promise<AgentState> {
    return this.agentManager.getAgentState(agentId);
  }

  async getAgentMetrics(agentId: string): Promise<AgentMetrics> {
    return this.agentManager.getAgentMetrics(agentId);
  }

  private async getAgentConfig(agentId: string): Promise<AgentConfig> {
    const events = await this.eventStore.getEvents(agentId);
    const startEvent = events.find(e => e.type === 'AGENT_STARTED');
    if (!startEvent) {
      throw new Error(`No start event found for agent ${agentId}`);
    }
    return startEvent.data.config as AgentConfig;
  }
} 