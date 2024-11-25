import { ToolConfig, ToolParams, ToolResult } from '../tools/types';

export interface IToolRegistry {
  register(tool: Tool): Promise<void>;
  get(toolId: string): Promise<Tool>;
  executeTool(toolId: string, params: ToolParams): Promise<ToolResult>;
  validateTool(tool: Tool): Promise<void>;
}

export interface Tool {
  id: string;
  name: string;
  version: string;
  configure(config: ToolConfig): Promise<void>;
  execute(params: ToolParams): Promise<ToolResult>;
  validate(params: ToolParams): Promise<boolean>;
  handleError(error: Error): Promise<void>;
} 