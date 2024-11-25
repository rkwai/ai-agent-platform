import React from 'react';
import { AgentStatus as AgentStatusType } from '../types';

interface AgentStatusProps {
  status: AgentStatusType;
}

export const AgentStatus: React.FC<AgentStatusProps> = ({ status }) => {
  const statusColors = {
    running: 'bg-green-100 text-green-800',
    stopped: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-sm ${statusColors[status]}`}>
      {status}
    </span>
  );
}; 