import { Database, Collection, QueryResult, Snapshot } from '../types/database';
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
    await this.db.collection('agent_states').updateOne(
      { agentId: event.agentId },
      { 
        $set: { 
          status: 'running',
          lastStartTime: event.metadata.timestamp,
          currentTask: event.data.taskId
        }
      },
      { upsert: true }
    );
  }

  private async handleAgentStopped(event: AgentEvent): Promise<void> {
    await this.db.collection('agent_states').updateOne(
      { agentId: event.agentId },
      { 
        $set: { 
          status: 'stopped',
          lastStopTime: event.metadata.timestamp,
          lastRunDuration: event.data.runDuration
        }
      }
    );
  }

  private async handleStateUpdated(event: AgentEvent): Promise<void> {
    if (!event.stateDelta) {
      throw new EventStoreError('State delta required for STATE_UPDATED event');
    }
    
    await this.db.collection('agent_states').updateOne(
      { agentId: event.agentId },
      { 
        $set: event.stateDelta,
        $push: { 
          stateHistory: {
            timestamp: event.metadata.timestamp,
            changes: event.stateDelta
          }
        }
      }
    );
  }

  private async handleToolAccessed(event: AgentEvent): Promise<void> {
    await this.db.collection('tool_usage').insertOne({
      agentId: event.agentId,
      toolId: event.data.toolId,
      timestamp: event.metadata.timestamp,
      duration: event.data.duration,
      success: event.data.success,
      error: event.data.error
    });
    
    // Update tool usage metrics
    await this.db.collection('agent_metrics').updateOne(
      { agentId: event.agentId },
      {
        $inc: {
          [`toolUsage.${event.data.toolId}`]: 1,
          totalToolCalls: 1
        }
      },
      { upsert: true }
    );
  }

  private async handleAssistanceRequested(event: AgentEvent): Promise<void> {
    await this.db.collection('assistance_requests').insertOne({
      agentId: event.agentId,
      timestamp: event.metadata.timestamp,
      type: event.data.assistanceType,
      status: 'pending',
      context: event.contextRef,
      priority: event.data.priority || 'medium'
    });
  }

  private async handleTaskCompleted(event: AgentEvent): Promise<void> {
    await this.db.collection('task_history').insertOne({
      agentId: event.agentId,
      taskId: event.data.taskId,
      startTime: event.data.startTime,
      endTime: event.metadata.timestamp,
      success: event.data.success,
      result: event.data.result
    });
    
    // Update agent metrics
    await this.db.collection('agent_metrics').updateOne(
      { agentId: event.agentId },
      {
        $inc: {
          totalTasks: 1,
          [`taskSuccess.${event.data.success ? 'success' : 'failure'}`]: 1
        },
        $push: {
          taskDurations: {
            $each: [event.data.duration],
            $slice: -100 // Keep last 100 durations for averaging
          }
        }
      },
      { upsert: true }
    );
  }

  private async handleErrorOccurred(event: AgentEvent): Promise<void> {
    await this.db.collection('error_logs').insertOne({
      agentId: event.agentId,
      timestamp: event.metadata.timestamp,
      error: event.data.error,
      severity: event.data.severity,
      context: event.contextRef
    });
    
    // Update error metrics
    await this.db.collection('agent_metrics').updateOne(
      { agentId: event.agentId },
      {
        $inc: {
          totalErrors: 1,
          [`errorsByType.${event.data.errorType}`]: 1
        }
      },
      { upsert: true }
    );
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

  async getEvents(
    agentId: string,
    afterTimestamp?: Date,
    beforeTimestamp?: Date
  ): Promise<AgentEvent[]> {
    const query = {
      agentId,
      ...(afterTimestamp && { 'metadata.timestamp': { $gt: afterTimestamp } }),
      ...(beforeTimestamp && { 'metadata.timestamp': { $lte: beforeTimestamp } })
    };
    
    const events = await this.db.collection('events')
      .find(query)
      .sort({ 'metadata.timestamp': 1 })
      .exec();
    
    return events as AgentEvent[];
  }

  async reconstructState(agentId: string, targetTimestamp?: Date): Promise<Record<string, unknown>> {
    const query = {
      agentId,
      ...(targetTimestamp && { 'metadata.timestamp': { $lte: targetTimestamp } })
    };
    
    // Get latest snapshot before target timestamp
    const snapshot = await this.db.collection('snapshots')
      .find({
        agentId,
        ...(targetTimestamp && { timestamp: { $lte: targetTimestamp } })
      })
      .sort({ timestamp: -1 })
      .limit(1)
      .exec<Snapshot>();
    
    const baseState = snapshot[0]?.state || {};
    const snapshotTimestamp = snapshot[0]?.timestamp;
    
    // Get all events after snapshot
    const events = await this.getEvents(
      agentId,
      snapshotTimestamp || new Date(0),
      targetTimestamp
    );
    
    // Reconstruct state by applying all events
    return events.reduce((state, event) => {
      if (event.stateDelta) {
        return { ...state, ...event.stateDelta };
      }
      return state;
    }, baseState);
  }

  async createSnapshot(agentId: string): Promise<void> {
    const state = await this.reconstructState(agentId);
    
    await this.db.collection('snapshots').insertOne({
      agentId,
      timestamp: new Date(),
      state
    });
  }
} 