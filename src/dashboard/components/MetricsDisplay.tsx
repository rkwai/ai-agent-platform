import React from 'react';
import { AgentMetrics } from '../types';

interface MetricsDisplayProps {
  metrics: AgentMetrics;
}

export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({ metrics }) => (
  <div className="grid grid-cols-2 gap-4">
    <div>
      <div className="text-sm font-medium">Success</div>
      <div className="text-2xl">{metrics.taskSuccess}</div>
    </div>
    <div>
      <div className="text-sm font-medium">Failures</div>
      <div className="text-2xl">{metrics.taskFailure}</div>
    </div>
  </div>
); 