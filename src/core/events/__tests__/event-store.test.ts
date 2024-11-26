import { Database, Collection, QueryResult } from '../../types/database';
import { EventStore } from '../event-store';
import { EventType } from '../types';
import { EventStoreError } from '../../errors';

const createMockCollection = (overrides: Partial<Collection> = {}): Collection => ({
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  }),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  insertOne: jest.fn().mockResolvedValue({ insertedId: 'id-1' }),
  ...overrides
});

describe('EventStore', () => {
  let eventStore: EventStore;
  let mockDb: jest.Mocked<Database>;
  let mockTransaction: { insert: jest.Mock; commit: jest.Mock; rollback: jest.Mock };

  beforeEach(() => {
    mockTransaction = {
      insert: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    };

    mockDb = {
      transaction: jest.fn().mockResolvedValue(mockTransaction),
      collection: jest.fn().mockReturnValue(createMockCollection())
    } as any;

    eventStore = new EventStore(mockDb);
  });

  describe('append', () => {
    it('should successfully append a valid event', async () => {
      const mockTransaction = {
        insert: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
      };

      mockDb.transaction.mockResolvedValue(mockTransaction);

      const event = {
        id: '123',
        agentId: 'agent-1',
        type: EventType.AGENT_STARTED,
        data: {},
        metadata: {
          correlationId: 'corr-1',
          timestamp: new Date(),
          version: '1.0',
          environment: 'test',
        },
      };

      await eventStore.append(event);

      expect(mockTransaction.insert).toHaveBeenCalledWith('events', event);
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(mockTransaction.rollback).not.toHaveBeenCalled();
    });

    it('should throw error and rollback on failure', async () => {
      const mockTransaction = {
        insert: jest.fn().mockRejectedValue(new Error('DB Error')),
        commit: jest.fn(),
        rollback: jest.fn(),
      };

      mockDb.transaction.mockResolvedValue(mockTransaction);

      const event = {
        id: '123',
        agentId: 'agent-1',
        type: EventType.AGENT_STARTED,
        data: {},
        metadata: {
          correlationId: 'corr-1',
          timestamp: new Date(),
          version: '1.0',
          environment: 'test',
        },
      };

      await expect(eventStore.append(event)).rejects.toThrow(EventStoreError);
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockTransaction.commit).not.toHaveBeenCalled();
    });
  });

  describe('getEvents', () => {
    it('should retrieve events for an agent', async () => {
      const mockEvents = [
        { id: '1', agentId: 'agent-1' },
        { id: '2', agentId: 'agent-1' },
      ];

      mockDb.collection.mockReturnValue(createMockCollection({ 
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockEvents)
          })
        })
      }));

      const events = await eventStore.getEvents('agent-1');
      expect(events).toEqual(mockEvents);
    });

    it('should filter events after timestamp', async () => {
      const timestamp = new Date();
      const mockFind = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([])
        })
      });

      mockDb.collection.mockReturnValue(createMockCollection({ find: mockFind }));

      await eventStore.getEvents('agent-1', timestamp);

      expect(mockFind).toHaveBeenCalledWith({
        agentId: 'agent-1',
        'metadata.timestamp': { $gt: timestamp },
      });
    });
  });

  describe('handleAgentStarted', () => {
    it('should update agent state when agent starts', async () => {
      const mockUpdateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      mockDb.collection.mockReturnValue(createMockCollection({ updateOne: mockUpdateOne }));

      const event = {
        id: '123',
        agentId: 'agent-1',
        type: EventType.AGENT_STARTED,
        data: { taskId: 'task-1' },
        metadata: {
          correlationId: 'corr-1',
          timestamp: new Date(),
          version: '1.0',
          environment: 'test',
        },
      };

      await eventStore.append(event);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { agentId: 'agent-1' },
        {
          $set: {
            status: 'running',
            lastStartTime: event.metadata.timestamp,
            currentTask: 'task-1'
          }
        },
        { upsert: true }
      );
    });
  });

  describe('handleStateUpdated', () => {
    it('should throw error if stateDelta is missing', async () => {
      const event = {
        id: '123',
        agentId: 'agent-1',
        type: EventType.STATE_UPDATED,
        data: {},
        metadata: {
          correlationId: 'corr-1',
          timestamp: new Date(),
          version: '1.0',
          environment: 'test',
        },
      };

      await expect(eventStore.append(event)).rejects.toThrow(EventStoreError);
    });

    it('should update state and maintain history', async () => {
      const mockUpdateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      mockDb.collection.mockReturnValue(createMockCollection({ updateOne: mockUpdateOne }));

      const event = {
        id: '123',
        agentId: 'agent-1',
        type: EventType.STATE_UPDATED,
        data: {},
        stateDelta: { key: 'value' },
        metadata: {
          correlationId: 'corr-1',
          timestamp: new Date(),
          version: '1.0',
          environment: 'test',
        },
      };

      await eventStore.append(event);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { agentId: 'agent-1' },
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
    });
  });

  describe('reconstructState', () => {
    it('should reconstruct state from snapshot and events', async () => {
      const mockSnapshot = {
        agentId: 'agent-1',
        timestamp: new Date('2023-01-01'),
        state: { initial: 'state' }
      };

      const mockEvents = [
        {
          agentId: 'agent-1',
          metadata: { timestamp: new Date('2023-01-02') },
          stateDelta: { key1: 'value1' }
        },
        {
          agentId: 'agent-1',
          metadata: { timestamp: new Date('2023-01-03') },
          stateDelta: { key2: 'value2' }
        }
      ];

      mockDb.collection.mockImplementation((name) => {
        if (name === 'snapshots') {
          return createMockCollection({
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([mockSnapshot])
                })
              })
            })
          });
        }
        if (name === 'events') {
          return createMockCollection({
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockEvents)
              })
            })
          });
        }
        return createMockCollection();
      });

      const state = await eventStore.reconstructState('agent-1');

      expect(state).toEqual({
        initial: 'state',
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should reconstruct state up to target timestamp', async () => {
      const targetTimestamp = new Date('2023-01-02T12:00:00Z');
      const mockSnapshot = {
        agentId: 'agent-1',
        timestamp: new Date('2023-01-01'),
        state: { initial: 'state' }
      };

      const mockEvents = [
        {
          agentId: 'agent-1',
          metadata: { timestamp: new Date('2023-01-02T06:00:00Z') },
          stateDelta: { key1: 'value1' }
        },
        {
          agentId: 'agent-1',
          metadata: { timestamp: new Date('2023-01-02T18:00:00Z') },
          stateDelta: { key2: 'value2' }
        }
      ];

      mockDb.collection.mockImplementation((name) => {
        if (name === 'snapshots') {
          return createMockCollection({
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([mockSnapshot])
                })
              })
            })
          });
        }
        if (name === 'events') {
          return createMockCollection({
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockEvents.filter(
                  e => e.metadata.timestamp <= targetTimestamp
                ))
              })
            })
          });
        }
        return createMockCollection();
      });

      const state = await eventStore.reconstructState('agent-1', targetTimestamp);

      expect(state).toEqual({
        initial: 'state',
        key1: 'value1'
      });
    });
  });

  describe('createSnapshot', () => {
    it('should create snapshot of current state', async () => {
      const mockInsertOne = jest.fn().mockResolvedValue({ insertedId: 'snap-1' });
      const currentState = { key1: 'value1', key2: 'value2' };
      
      // Mock reconstructState to return a known state
      jest.spyOn(eventStore, 'reconstructState').mockResolvedValue(currentState);
      
      mockDb.collection.mockReturnValue(createMockCollection({ insertOne: mockInsertOne }));

      await eventStore.createSnapshot('agent-1');

      expect(mockInsertOne).toHaveBeenCalledWith({
        agentId: 'agent-1',
        timestamp: expect.any(Date),
        state: currentState
      });
    });
  });
}); 