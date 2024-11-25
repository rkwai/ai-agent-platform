import { AgentOrchestrator } from '../services/agent-orchestrator';
import { AgentConfig, AgentState, AgentMetrics } from '../agents/types';

export class DashboardFacade {
  constructor(private readonly orchestrator: AgentOrchestrator) {}

  async getAgentOverview(agentId: string): Promise<{
    state: AgentState;
    metrics: AgentMetrics;
  }> {
    const state = await this.orchestrator.getAgentState(agentId);
    const metrics = await this.orchestrator.getAgentMetrics(agentId);
    return { state, metrics };
  }

  async createAgent(config: AgentConfig): Promise<void> {
    await this.orchestrator.createAgent(config);
  }

  async assistAgent(
    agentId: string,
    response: Record<string, unknown>
  ): Promise<void> {
    await this.orchestrator.provideAssistance(agentId, response);
  }

  async getAssistanceRequests(): Promise<Array<{
    agentId: string;
    context: Record<string, unknown>;
    timestamp: Date;
  }>> {
    // Implementation would fetch and return pending assistance requests
    return [];
  }
} 