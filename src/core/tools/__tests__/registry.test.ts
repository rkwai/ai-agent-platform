import { EventStore } from '../../events/event-store';
import { Tool, ToolConfig, ToolParams, ToolResult } from '../types';
import { ToolRegistry } from '../registry';
import { ToolRegistryError } from '../../errors';

class MockTool implements Tool {
  constructor(
    public id: string,
    public name: string,
    public version: string
  ) {}

  async configure(config: ToolConfig): Promise<void> {}
  async execute(params: ToolParams): Promise<ToolResult> {
    return { success: true };
  }
  async validate(params: ToolParams): Promise<boolean> {
    return true;
  }
  async handleError(error: Error): Promise<void> {}
}

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry;
  let mockEventStore: jest.Mocked<EventStore>;

  beforeEach(() => {
    mockEventStore = {
      append: jest.fn(),
      getEvents: jest.fn(),
    } as any;

    toolRegistry = new ToolRegistry(mockEventStore);
  });

  describe('register', () => {
    it('should successfully register a valid tool', async () => {
      const tool = new MockTool('test-tool', 'Test Tool', '1.0.0');
      await toolRegistry.register(tool);
      const registeredTool = await toolRegistry.get('test-tool');
      expect(registeredTool).toBe(tool);
    });

    it('should throw error when registering duplicate tool', async () => {
      const tool = new MockTool('test-tool', 'Test Tool', '1.0.0');
      await toolRegistry.register(tool);
      await expect(toolRegistry.register(tool)).rejects.toThrow(ToolRegistryError);
    });
  });

  describe('executeTool', () => {
    it('should successfully execute tool and log event', async () => {
      const tool = new MockTool('test-tool', 'Test Tool', '1.0.0');
      await toolRegistry.register(tool);

      const params = {
        action: 'test',
        parameters: { agentId: 'agent-1' }
      };

      await toolRegistry.executeTool('test-tool', params);
      expect(mockEventStore.append).toHaveBeenCalled();
    });

    it('should throw error when executing non-existent tool', async () => {
      const params = {
        action: 'test',
        parameters: { agentId: 'agent-1' }
      };

      await expect(toolRegistry.executeTool('non-existent', params))
        .rejects.toThrow(ToolRegistryError);
    });
  });
}); 