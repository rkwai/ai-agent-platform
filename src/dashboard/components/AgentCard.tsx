import React from 'react';
import { AgentState, TaskExecution } from '../../core/agent/types';

interface AgentCardProps {
  agent: AgentState;
  onPause: (agentId: string) => Promise<void>;
  onResume: (agentId: string) => Promise<void>;
  onRecover: (agentId: string) => Promise<void>;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onPause,
  onResume,
  onRecover
}) => {
  const handleAction = async (action: 'pause' | 'resume' | 'recover') => {
    try {
      switch (action) {
        case 'pause':
          await onPause(agent.id);
          break;
        case 'resume':
          await onResume(agent.id);
          break;
        case 'recover':
          await onRecover(agent.id);
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} agent:`, error);
    }
  };

  const renderTaskInfo = (task: TaskExecution) => (
    <div className="task-info">
      <h4>{task.type}</h4>
      <div className="progress-bar">
        <div 
          className="progress" 
          style={{ width: `${task.progress}%` }}
        />
      </div>
      <span>{task.status}</span>
    </div>
  );

  return (
    <div className="agent-card">
      <div className="header">
        <h3>{agent.id}</h3>
        <span className={`status ${agent.status}`}>
          {agent.status}
        </span>
      </div>

      <div className="content">
        {agent.currentTask && renderTaskInfo(agent.currentTask)}
        
        <div className="tools">
          <h4>Available Tools</h4>
          <ul>
            {agent.tools.map(tool => (
              <li key={tool.id}>{tool.name} v{tool.version}</li>
            ))}
          </ul>
        </div>

        <div className="metadata">
          <p>Created: {agent.metadata.createdAt.toLocaleString()}</p>
          <p>Last Active: {agent.metadata.lastActiveAt?.toLocaleString()}</p>
        </div>
      </div>

      <div className="actions">
        {agent.status === 'executing' && (
          <button 
            onClick={() => handleAction('pause')}
            className="pause"
          >
            Pause
          </button>
        )}
        {agent.status === 'paused' && (
          <button 
            onClick={() => handleAction('resume')}
            className="resume"
          >
            Resume
          </button>
        )}
        {agent.status === 'error' && (
          <button 
            onClick={() => handleAction('recover')}
            className="recover"
          >
            Recover
          </button>
        )}
      </div>
    </div>
  );
}; 