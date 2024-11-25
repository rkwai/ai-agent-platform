import React from 'react';
import { Task } from '../types';

interface TaskProgressProps {
  task: Task;
}

export const TaskProgress: React.FC<TaskProgressProps> = ({ task }) => (
  <div className="mb-4">
    <div className="flex justify-between mb-1">
      <span className="text-sm font-medium">{task.name}</span>
      <span className="text-sm text-gray-600">{task.progress}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className="bg-blue-600 h-2 rounded-full" 
        style={{ width: `${task.progress}%` }}
      />
    </div>
  </div>
); 