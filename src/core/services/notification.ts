export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface NotificationChannel {
  send(notification: Notification): Promise<void>;
  isAvailable(): Promise<boolean>;
  getPreferences(managerId: string): Promise<Record<string, unknown>>;
}

export class NotificationService {
  async alertManager(notification: Record<string, unknown>): Promise<void> {
    // Implementation placeholder
  }

  async sendNotification(notification: Record<string, unknown>): Promise<void> {
    // Implementation placeholder
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getPreferences(managerId: string): Promise<Record<string, unknown>> {
    return {};
  }
} 