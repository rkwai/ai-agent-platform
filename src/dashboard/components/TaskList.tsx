import React from 'react';
import { QueuedTask, TaskSchedule } from '../../core/tasks/types';

interface TaskListProps {
  tasks: QueuedTask[];
  onCancel: (taskId: string) => Promise<void>;
  onRetry: (taskId: string) => Promise<void>;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onCancel,
  onRetry
}) => {
  const handleAction = async (action: 'cancel' | 'retry', task: QueuedTask) => {
    try {
      switch (action) {
        case 'cancel':
          await onCancel(task.schedule.taskId);
          break;
        case 'retry':
          await onRetry(task.schedule.taskId);
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} task:`, error);
    }
  };

  const renderTaskActions = (task: QueuedTask) => {
    switch (task.status) {
      case 'pending':
      case 'scheduled':
      case 'executing':
        return (
          <button
            onClick={() => handleAction('cancel', task)}
            className="cancel"
          >
            Cancel
          </button>
        );
      case 'failed':
        return (
          <button
            onClick={() => handleAction('retry', task)}
            className="retry"
          >
            Retry
          </button>
        );
      default:
        return null;
    }
  };

  const renderPriority = (priority: number) => {
    const levels = ['Low', 'Medium', 'High', 'Critical'];
    return levels[Math.min(priority, 3)];
  };

  return (
    <div className="task-list">
      <h3>Tasks</h3>
      <div className="list">
        {tasks.map(task => (
          <div key={task.schedule.taskId} className={`task-item ${task.status}`}>
            <div className="task-header">
              <h4>{task.schedule.taskId}</h4>
              <span className={`status ${task.status}`}>
                {task.status}
              </span>
            </div>

            <div className="task-details">
              <div className="priority">
                Priority: {renderPriority(task.schedule.priority)}
              </div>
              
              <div className="schedule">
                Scheduled: {task.schedule.scheduledTime.toLocaleString()}
                {task.schedule.deadline && (
                  <span className="deadline">
                    Due: {task.schedule.deadline.toLocaleString()}
                  </span>
                )}
              </div>

              {task.attempts > 0 && (
                <div className="attempts">
                  Attempts: {task.attempts}
                  {task.nextAttempt && (
                    <span className="next-attempt">
                      Next: {task.nextAttempt.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {task.schedule.dependencies && task.schedule.dependencies.length > 0 && (
                <div className="dependencies">
                  Dependencies: {task.schedule.dependencies.join(', ')}
                </div>
              )}
            </div>

            <div className="task-actions">
              {renderTaskActions(task)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 