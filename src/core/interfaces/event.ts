import { EventType } from '../events/types';

export interface IEventStore {
  append(event: AgentEvent): Promise<void>;
  getEvents(agentId: string, afterTimestamp?: Date): Promise<AgentEvent[]>;
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

export interface EventMetadata {
  correlationId: string;
  causationId?: string;
  timestamp: Date;
  version: string;
  environment: string;
} 