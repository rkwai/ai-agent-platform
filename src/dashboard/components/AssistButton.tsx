import React from 'react';

interface AssistButtonProps {
  onClick: () => Promise<void>;
  disabled: boolean;
}

export const AssistButton: React.FC<AssistButtonProps> = ({ onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 rounded-md text-sm font-medium text-white
      ${disabled 
        ? 'bg-gray-400 cursor-not-allowed' 
        : 'bg-blue-600 hover:bg-blue-700'}`}
  >
    Assist Agent
  </button>
); 