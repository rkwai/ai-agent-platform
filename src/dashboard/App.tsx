import React from 'react';

/**
 * Main application component for the AI Agent Dashboard
 */
const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">AI Agent Dashboard</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Welcome to the AI Agent Platform. Start by configuring your first agent.</p>
        </div>
      </div>
    </div>
  );
};

export default App;
