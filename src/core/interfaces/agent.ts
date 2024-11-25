import { AgentConfig, AgentState, AgentMetrics } from '../agents/types';
import { ToolParams, ToolResult } from '../tools/types';

export interface IAgentManager {
  initialize(): Promise<void>;
  registerAgent(config: AgentConfig): Promise<void>;
  getAgentState(agentId: string): Promise<AgentState>;
  getAgentMetrics(agentId: string): Promise<AgentMetrics>;
  requestAssistance(agentId: string, context: Record<string, unknown>): Promise<void>;
  provideAssistance(agentId: string, response: Record<string, unknown>): Promise<void>;
  executeTool(agentId: string, toolId: string, params: ToolParams): Promise<ToolResult>;
} 