import React from 'react';

interface ErrorStateProps {
  error: Error;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error }) => (
  <div className="error-state">
    <span>Error: {error.message}</span>
  </div>
); 