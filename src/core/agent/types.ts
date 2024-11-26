import { Tool } from '../tools/types';

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentTask?: TaskExecution;
  tools: Tool[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastActiveAt?: Date;
  };
}

export type AgentStatus = 
  | 'idle' 
  | 'executing' 
  | 'paused' 
  | 'error' 
  | 'recovering';

export interface TaskExecution {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
  status: TaskStatus;
  progress: number;
  result?: TaskResult;
  error?: Error;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentConfig {
  id: string;
  tools: Tool[];
  maxConcurrentTasks?: number;
  recoveryStrategy?: RecoveryStrategy;
}

export type RecoveryStrategy = 
  | 'retry'
  | 'rollback'
  | 'skip'
  | 'manual'; 