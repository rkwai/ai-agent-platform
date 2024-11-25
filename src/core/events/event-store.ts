import { Database } from '../types/database';
import { EventStoreError } from '../errors';
import { AgentEvent, EventType } from './types';

export class EventStore {
  constructor(private readonly db: Database) {}

  private async verifyEventOrder(event: AgentEvent): Promise<void> {
    const lastEvent = await this.getLastEvent(event.agentId);
    
    if (lastEvent && lastEvent.metadata.timestamp > event.metadata.timestamp) {
      throw new EventStoreError('Event timestamp violates temporal order');
    }
  }

  private async getLastEvent(agentId: string): Promise<AgentEvent | null> {
    const events = await this.db.collection('events')
      .find({ agentId })
      .sort({ 'metadata.timestamp': -1 })
      .limit(1)
      .exec();
    
    return events[0] as AgentEvent || null;
  }

  private async handleAgentStarted(event: AgentEvent): Promise<void> {
    await this.db.collection('agent_states')
      .find({ agentId: event.agentId })
      .exec();
  }

  private async handleAgentStopped(event: AgentEvent): Promise<void> {
    await this.db.collection('agent_states')
      .find({ agentId: event.agentId })
      .exec();
  }

  private async handleStateUpdated(event: AgentEvent): Promise<void> {
    await this.db.collection('agent_states')
      .find({ agentId: event.agentId })
      .exec();
  }

  private async handleToolAccessed(event: AgentEvent): Promise<void> {
    await this.db.collection('tool_usage')
      .find({ agentId: event.agentId })
      .exec();
  }

  private async handleAssistanceRequested(event: AgentEvent): Promise<void> {
    await this.db.collection('assistance_requests')
      .find({ agentId: event.agentId })
      .exec();
  }

  private async handleTaskCompleted(event: AgentEvent): Promise<void> {
    await this.db.collection('task_history')
      .find({ agentId: event.agentId })
      .exec();
  }

  private async handleErrorOccurred(event: AgentEvent): Promise<void> {
    await this.db.collection('error_logs')
      .find({ agentId: event.agentId })
      .exec();
  }

  private async handleAgentRegistered(event: AgentEvent): Promise<void> {
    await this.db.collection('agent_states')
      .find({ agentId: event.agentId })
      .exec();
  }

  private async updateProjections(event: AgentEvent): Promise<void> {
    const projectionHandlers: Record<EventType, (event: AgentEvent) => Promise<void>> = {
      [EventType.AGENT_REGISTERED]: this.handleAgentRegistered.bind(this),
      [EventType.AGENT_STARTED]: this.handleAgentStarted.bind(this),
      [EventType.AGENT_STOPPED]: this.handleAgentStopped.bind(this),
      [EventType.STATE_UPDATED]: this.handleStateUpdated.bind(this),
      [EventType.TOOL_ACCESSED]: this.handleToolAccessed.bind(this),
      [EventType.ASSISTANCE_REQUESTED]: this.handleAssistanceRequested.bind(this),
      [EventType.TASK_COMPLETED]: this.handleTaskCompleted.bind(this),
      [EventType.ERROR_OCCURRED]: this.handleErrorOccurred.bind(this)
    };

    const handler = projectionHandlers[event.type];
    if (handler) {
      await handler(event);
    }
  }

  async append(event: AgentEvent): Promise<void> {
    const transaction = await this.db.transaction();
    
    try {
      await this.verifyEventOrder(event);
      await transaction.insert('events', event);
      await this.updateProjections(event);
      await transaction.commit();
    } catch (error: unknown) {
      await transaction.rollback();
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new EventStoreError(`Failed to append event: ${message}`);
    }
  }

  async getEvents(agentId: string, afterTimestamp?: Date): Promise<AgentEvent[]> {
    const query = {
      agentId,
      ...(afterTimestamp && { 'metadata.timestamp': { $gt: afterTimestamp } })
    };
    
    const events = await this.db.collection('events')
      .find(query)
      .sort({ 'metadata.timestamp': 1 })
      .exec();
    
    return events as AgentEvent[];
  }
} 