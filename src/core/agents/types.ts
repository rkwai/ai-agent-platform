export enum AgentStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  WAITING_FOR_ASSISTANCE = 'WAITING_FOR_ASSISTANCE',
  ERROR = 'ERROR',
  STOPPED = 'STOPPED'
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  allowedTools: string[];
  maxConcurrentTasks: number;
  assistanceThreshold: number;
}

export interface AgentState {
  status: AgentStatus;
  currentTaskId?: string;
  lastActivity: Date;
  errorCount: number;
  assistanceCount: number;
}

export interface AgentMetrics {
  taskSuccessCount: number;
  taskFailureCount: number;
  averageTaskDuration: number;
  toolUsageCount: Record<string, number>;
  assistanceRequestCount: number;
} 