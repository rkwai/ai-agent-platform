import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { EventStore } from '../../events/event-store';
import { ToolRegistry } from '../../tools/registry';
import { NotificationService } from '../../services/notification';
import { AgentManager } from '../manager';
import { AgentConfig, AgentStatus } from '../types';
import { AgentEvent, EventType } from '../../events/types';

describe('AgentManager', () => {
  let agentManager: AgentManager;
  let mockEventStore: jest.Mocked<EventStore>;
  let mockToolRegistry: jest.Mocked<ToolRegistry>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockEventStore = {
      append: jest.fn(),
      getEvents: jest.fn().mockImplementation(async () => []),
      verifyEventOrder: jest.fn().mockImplementation(async () => true),
      getLastEvent: jest.fn().mockImplementation(async () => null),
      handleAgentStarted: jest.fn(),
      handleAgentStopped: jest.fn(),
      handleTaskStarted: jest.fn(),
      handleTaskCompleted: jest.fn(),
      handleTaskFailed: jest.fn(),
      handleAssistanceRequested: jest.fn(),
      handleStateUpdated: jest.fn(),
      handleToolAccessed: jest.fn(),
      handleErrorOccurred: jest.fn(),
      updateProjections: jest.fn()
    } as Partial<EventStore> as jest.Mocked<EventStore>;

    mockToolRegistry = {
      get: jest.fn(),
      executeTool: jest.fn(),
      register: jest.fn()
    } as Partial<ToolRegistry> as jest.Mocked<ToolRegistry>;

    mockNotificationService = {
      alertManager: jest.fn(),
      sendNotification: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(Promise.resolve(true)),
      getPreferences: jest.fn().mockReturnValue(Promise.resolve({}))
    } as Partial<NotificationService> as jest.Mocked<NotificationService>;

    agentManager = new AgentManager(
      mockEventStore, 
      mockToolRegistry,
      mockNotificationService
    );
  });

  describe('registerAgent', () => {
    it('should successfully register a new agent', async () => {
      const config: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        allowedTools: ['gmail'],
        maxConcurrentTasks: 1,
        assistanceThreshold: 3
      };

      await agentManager.registerAgent(config);
      const state = await agentManager.getAgentState('test-agent');
      
      expect(state.status).toBe(AgentStatus.IDLE);
      expect(mockEventStore.append).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventType.AGENT_REGISTERED,
          agentId: config.id,
          data: {
            id: config.id,
            name: config.name,
            description: config.description,
            allowedTools: config.allowedTools,
            maxConcurrentTasks: config.maxConcurrentTasks,
            assistanceThreshold: config.assistanceThreshold
          }
        })
      );
    });

    it('should throw error when registering duplicate agent', async () => {
      const config: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        allowedTools: ['gmail'],
        maxConcurrentTasks: 1,
        assistanceThreshold: 3
      };

      await agentManager.registerAgent(config);
      await expect(agentManager.registerAgent(config)).rejects.toThrow();
    });
  });

  describe('requestAssistance', () => {
    it('should update agent state and notify manager when assistance is requested', async () => {
      const config: AgentConfig = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        allowedTools: ['gmail'],
        maxConcurrentTasks: 1,
        assistanceThreshold: 3
      };

      await agentManager.registerAgent(config);
      await agentManager.requestAssistance('test-agent', { reason: 'test' });

      const state = await agentManager.getAgentState('test-agent');
      expect(state.status).toBe(AgentStatus.WAITING_FOR_ASSISTANCE);
      expect(state.assistanceCount).toBe(1);
      expect(mockNotificationService.alertManager).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent',
          reason: 'test'
        })
      );
    });
  });
}); 