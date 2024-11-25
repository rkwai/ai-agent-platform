import { Database, Collection, QueryResult } from '../../types/database';
import { EventStore } from '../event-store';
import { EventType } from '../types';
import { EventStoreError } from '../../errors';

describe('EventStore', () => {
  let eventStore: EventStore;
  let mockDb: jest.Mocked<Database>;
  let mockQueryResult: jest.Mocked<QueryResult>;

  beforeEach(() => {
    mockQueryResult = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    };

    const mockCollection: Partial<Collection> = {
      find: jest.fn().mockReturnValue(mockQueryResult)
    };

    mockDb = {
      transaction: jest.fn(),
      collection: jest.fn().mockReturnValue(mockCollection)
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

      mockDb.collection.mockReturnValue({
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockEvents)
          })
        })
      });

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

      mockDb.collection.mockReturnValue({ find: mockFind });

      await eventStore.getEvents('agent-1', timestamp);

      expect(mockFind).toHaveBeenCalledWith({
        agentId: 'agent-1',
        'metadata.timestamp': { $gt: timestamp },
      });
    });
  });
}); 