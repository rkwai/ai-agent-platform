import { EventStore } from '../events/event-store';
import { EventType } from '../events/types';
import { ToolRegistryError } from '../errors';
import { Tool, ToolParams, ToolResult } from './types';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor(private readonly eventStore: EventStore) {}

  async register(tool: Tool): Promise<void> {
    if (this.tools.has(tool.id)) {
      throw new ToolRegistryError(`Tool ${tool.id} already registered`);
    }
    
    await this.validateTool(tool);
    this.tools.set(tool.id, tool);
  }

  public async validateTool(tool: Tool): Promise<void> {
    try {
      // Basic validation of tool interface
      if (!tool.id || !tool.name || !tool.version) {
        throw new Error('Tool missing required properties');
      }

      // Validate tool methods exist
      const requiredMethods = ['configure', 'execute', 'validate', 'handleError'];
      for (const method of requiredMethods) {
        if (typeof tool[method as keyof Tool] !== 'function') {
          throw new Error(`Tool missing required method: ${method}`);
        }
      }

      // All validations passed
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ToolRegistryError(`Tool validation failed: ${message}`);
    }
  }

  async get(toolId: string): Promise<Tool> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new ToolRegistryError(`Tool ${toolId} not found`);
    }
    return tool;
  }

  async executeTool(toolId: string, params: ToolParams): Promise<ToolResult> {
    const tool = await this.get(toolId);
    
    try {
      await tool.validate(params);
      const result = await tool.execute(params);
      
      await this.eventStore.append({
        id: crypto.randomUUID(),
        agentId: params.parameters.agentId as string,
        type: EventType.TOOL_ACCESSED,
        data: { toolId, params, result },
        metadata: {
          correlationId: crypto.randomUUID(),
          timestamp: new Date(),
          version: '1.0',
          environment: process.env.NODE_ENV || 'development'
        }
      });
      
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await tool.handleError(new Error(message));
      throw new ToolRegistryError(`Tool execution failed: ${message}`);
    }
  }
} 