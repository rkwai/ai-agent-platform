export interface ToolConfig {
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
}

export interface ToolParams {
  action: string;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
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