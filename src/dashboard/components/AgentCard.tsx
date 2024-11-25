import { AgentStatus as AgentStatusType, Task, AgentMetrics } from '../types';
import { useAgentData } from '../hooks/useAgentData';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { Card, CardHeader, CardContent, CardFooter } from './Card';
import { AgentStatus } from './AgentStatus';
import { AgentIdentifier } from './AgentIdentifier';
import { TaskProgress } from './TaskProgress';
import { MetricsDisplay } from './MetricsDisplay';
import { AssistButton } from './AssistButton';

interface AgentCardProps {
  agentId: string;
  status: AgentStatusType;
  currentTask?: Task;
  metrics: AgentMetrics;
  onAssist: (agentId: string) => Promise<void>;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agentId,
  status,
  currentTask,
  metrics,
  onAssist
}) => {
  const { data, error, isLoading } = useAgentData(agentId);
  
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  
  return (
    <Card>
      <CardHeader>
        <AgentStatus status={status} />
        <AgentIdentifier id={agentId} />
      </CardHeader>
      
      <CardContent>
        {currentTask && <TaskProgress task={currentTask} />}
        <MetricsDisplay metrics={metrics} />
      </CardContent>
      
      <CardFooter>
        <AssistButton 
          onClick={() => onAssist(agentId)}
          disabled={status === 'stopped'}
        />
      </CardFooter>
    </Card>
  );
}; 