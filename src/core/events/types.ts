export enum EventType {
  AGENT_REGISTERED = 'AGENT_REGISTERED',
  AGENT_STARTED = 'AGENT_STARTED',
  AGENT_STOPPED = 'AGENT_STOPPED',
  STATE_UPDATED = 'STATE_UPDATED',
  TOOL_ACCESSED = 'TOOL_ACCESSED',
  ASSISTANCE_REQUESTED = 'ASSISTANCE_REQUESTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  ERROR_OCCURRED = 'ERROR_OCCURRED'
}

export interface EventMetadata {
  correlationId: string;
  causationId?: string;
  timestamp: Date;
  version: string;
  environment: string;
}

export interface AgentEvent {
  id: string;
  agentId: string;
  type: EventType;
  data: Record<string, unknown>;
  metadata: EventMetadata;
  stateDelta?: Record<string, unknown>;
  contextRef?: string;
} 