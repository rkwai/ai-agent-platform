import { TaskExecution, TaskResult } from '../agent/types';

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  toolRequirements: string[];
  parameters: TaskParameterDefinition[];
  validation?: TaskValidation;
  retryPolicy?: RetryPolicy;
  timeout?: number;
}

export interface TaskParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: unknown;
  validation?: ParameterValidation;
}

export interface TaskValidation {
  preconditions?: TaskPrecondition[];
  postconditions?: TaskPostcondition[];
}

export interface TaskPrecondition {
  check: (params: Record<string, unknown>) => Promise<boolean>;
  message: string;
}

export interface TaskPostcondition {
  check: (result: TaskResult) => Promise<boolean>;
  message: string;
}

export interface ParameterValidation {
  pattern?: string;
  min?: number;
  max?: number;
  enum?: unknown[];
  custom?: (value: unknown) => Promise<boolean>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export interface TaskSchedule {
  taskId: string;
  agentId: string;
  priority: number;
  scheduledTime: Date;
  deadline?: Date;
  dependencies?: string[];
  parameters: Record<string, unknown>;
  metadata: {
    createdAt: Date;
    createdBy: string;
    tags?: string[];
  };
}

export interface TaskQueue {
  id: string;
  name: string;
  tasks: QueuedTask[];
  concurrencyLimit: number;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface QueuedTask {
  schedule: TaskSchedule;
  status: QueueStatus;
  attempts: number;
  lastAttempt?: Date;
  nextAttempt?: Date;
  execution?: TaskExecution;
}

export type QueueStatus = 
  | 'pending'
  | 'scheduled'
  | 'blocked'
  | 'executing'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled'; 