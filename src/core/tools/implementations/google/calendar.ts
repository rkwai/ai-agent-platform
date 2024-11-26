import { ToolParams, ToolResult } from '../../types';
import { GoogleTool } from './base';

interface CalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: { email: string }[];
}

export class GoogleCalendarTool extends GoogleTool {
  private readonly API_BASE = 'https://www.googleapis.com/calendar/v3';

  async execute(params: ToolParams): Promise<ToolResult> {
    await this.validate(params);

    try {
      switch (params.action) {
        case 'createEvent':
          return await this.createEvent(params.parameters);
        case 'listEvents':
          return await this.listEvents(params.parameters);
        case 'updateEvent':
          return await this.updateEvent(params.parameters);
        case 'deleteEvent':
          return await this.deleteEvent(params.parameters);
        default:
          throw new Error(`Unsupported action: ${params.action}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.handleError(error instanceof Error ? error : new Error(message));
      return {
        success: false,
        error: message
      };
    }
  }

  async validate(params: ToolParams): Promise<boolean> {
    await super.validate(params);

    const requiredParams: Record<string, string[]> = {
      createEvent: ['summary', 'start', 'end'],
      listEvents: ['timeMin', 'timeMax'],
      updateEvent: ['eventId', 'summary', 'start', 'end'],
      deleteEvent: ['eventId']
    };

    const required = requiredParams[params.action];
    if (!required) {
      throw new Error(`Invalid action: ${params.action}`);
    }

    for (const param of required) {
      if (!(param in params.parameters)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }

    return true;
  }

  private async createEvent(params: Record<string, unknown>): Promise<ToolResult> {
    const event: CalendarEvent = {
      summary: params.summary as string,
      description: params.description as string,
      start: {
        dateTime: params.start as string,
        timeZone: params.timeZone as string
      },
      end: {
        dateTime: params.end as string,
        timeZone: params.timeZone as string
      }
    };

    if (params.attendees) {
      event.attendees = (params.attendees as string[]).map(email => ({ email }));
    }

    const response = await fetch(`${this.API_BASE}/calendars/primary/events`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      throw new Error(`Failed to create event: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  }

  private async listEvents(params: Record<string, unknown>): Promise<ToolResult> {
    const queryParams = new URLSearchParams({
      timeMin: params.timeMin as string,
      timeMax: params.timeMax as string,
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const response = await fetch(
      `${this.API_BASE}/calendars/primary/events?${queryParams}`,
      {
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list events: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.items
    };
  }

  private async updateEvent(params: Record<string, unknown>): Promise<ToolResult> {
    const { eventId, ...eventData } = params;
    const event: CalendarEvent = {
      summary: eventData.summary as string,
      start: {
        dateTime: eventData.start as string,
        timeZone: eventData.timeZone as string
      },
      end: {
        dateTime: eventData.end as string,
        timeZone: eventData.timeZone as string
      }
    };

    const response = await fetch(
      `${this.API_BASE}/calendars/primary/events/${eventId}`,
      {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(event)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update event: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  }

  private async deleteEvent(params: Record<string, unknown>): Promise<ToolResult> {
    const response = await fetch(
      `${this.API_BASE}/calendars/primary/events/${params.eventId}`,
      {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete event: ${response.statusText}`);
    }

    return {
      success: true
    };
  }
} 