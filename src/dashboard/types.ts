export type AgentStatus = 'running' | 'stopped' | 'error';

export interface Task {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface AgentMetrics {
  taskSuccess: number;
  taskFailure: number;
  averageExecutionTime: number;
  toolUsage: Record<string, number>;
  recoveryAttempts: number;
  managerInterventions: number;
} 