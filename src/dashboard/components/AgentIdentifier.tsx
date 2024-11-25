import React from 'react';

interface AgentIdentifierProps {
  id: string;
}

export const AgentIdentifier: React.FC<AgentIdentifierProps> = ({ id }) => (
  <div className="text-sm text-gray-600">
    ID: {id.slice(0, 8)}...
  </div>
); 