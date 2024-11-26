import { GoogleCalendarTool } from '../calendar';
import { ToolParams } from '../../../types';
import { CredentialManager } from '../../../credential-manager';

// Mock fetch globally
global.fetch = jest.fn();

describe('GoogleCalendarTool', () => {
  let calendarTool: GoogleCalendarTool;
  
  beforeEach(async () => {
    const mockCredentialManager = {
      credentials: new Map(),
      encryptionKey: 'test-key',
      get: jest.fn().mockResolvedValue({
        type: 'oauth2',
        data: {
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          scope: 'https://www.googleapis.com/auth/calendar'
        }
      }),
      store: jest.fn(),
      delete: jest.fn(),
      refreshOAuth2Token: jest.fn(),
      validateCredential: jest.fn(),
      validateOAuth2Credential: jest.fn()
    } as unknown as CredentialManager;

    calendarTool = new GoogleCalendarTool(
      'calendar-1',
      'Google Calendar',
      '1.0.0',
      mockCredentialManager,
      'calendar-cred-1'
    );

    await calendarTool.configure({
      credentials: {
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret'
      },
      settings: {}
    });
    
    // Mock the getAuthHeaders method from base class
    jest.spyOn(calendarTool as any, 'getAuthHeaders').mockReturnValue({
      'Authorization': 'Bearer mock-token'
    });
    // Clear fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  describe('listEvents', () => {
    it('should successfully list calendar events', async () => {
      const mockResponse = {
        items: [
          {
            id: 'event1',
            summary: 'Test Event 1',
            start: { dateTime: '2024-01-01T10:00:00Z' },
            end: { dateTime: '2024-01-01T11:00:00Z' }
          },
          {
            id: 'event2',
            summary: 'Test Event 2',
            start: { dateTime: '2024-01-02T14:00:00Z' },
            end: { dateTime: '2024-01-02T15:00:00Z' }
          }
        ],
        nextPageToken: 'token123'
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const params: ToolParams = {
        action: 'listEvents',
        parameters: {
          calendarId: 'primary',
          timeMin: '2024-01-01T00:00:00Z',
          timeMax: '2024-01-31T23:59:59Z',
          maxResults: '10'
        }
      };

      const result = await calendarTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.items);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/calendars/primary/events'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
    });
  });

  describe('createEvent', () => {
    it('should successfully create a calendar event', async () => {
      const mockResponse = {
        id: 'new-event-123',
        summary: 'New Test Event',
        start: { dateTime: '2024-01-15T10:00:00Z' },
        end: { dateTime: '2024-01-15T11:00:00Z' }
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const params: ToolParams = {
        action: 'createEvent',
        parameters: {
          calendarId: 'primary',
          summary: 'New Test Event',
          start: { dateTime: '2024-01-15T10:00:00Z' },
          end: { dateTime: '2024-01-15T11:00:00Z' },
          description: 'Test event description'
        }
      };

      const result = await calendarTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data as any).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/calendars/primary/events'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String)
        })
      );
    });

    it('should handle event creation failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      });

      const params: ToolParams = {
        action: 'createEvent',
        parameters: {
          calendarId: 'primary',
          summary: 'New Test Event',
          start: { dateTime: '2024-01-15T10:00:00Z' },
          end: { dateTime: '2024-01-15T11:00:00Z' },
          description: 'Test event description'
        }
      };

      const result = await calendarTool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create event');
    });
  });

  describe('updateEvent', () => {
    it('should successfully update a calendar event', async () => {
      const mockResponse = {
        id: 'event-123',
        summary: 'Updated Test Event',
        start: { dateTime: '2024-01-15T10:00:00Z' },
        end: { dateTime: '2024-01-15T11:00:00Z' }
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const params: ToolParams = {
        action: 'updateEvent',
        parameters: {
          calendarId: 'primary',
          eventId: 'event-123',
          summary: 'Updated Test Event',
          start: { dateTime: '2024-01-15T10:00:00Z' },
          end: { dateTime: '2024-01-15T11:00:00Z' }
        }
      };

      const result = await calendarTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/calendars/primary/events/event-123'),
        expect.objectContaining({
          method: 'PATCH'
        })
      );
    });
  });

  describe('deleteEvent', () => {
    it('should successfully delete a calendar event', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const params: ToolParams = {
        action: 'deleteEvent',
        parameters: {
          calendarId: 'primary',
          eventId: 'event-123'
        }
      };

      const result = await calendarTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/calendars/primary/events/event-123'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('validation', () => {
    it('should validate required parameters for createEvent', async () => {
      const params: ToolParams = {
        action: 'createEvent',
        parameters: {
          calendarId: 'primary'
          // missing event object
        }
      };

      await expect(calendarTool.execute(params)).rejects.toThrow('Missing required parameter');
    });

    it('should validate required parameters for updateEvent', async () => {
      const params: ToolParams = {
        action: 'updateEvent',
        parameters: {
          calendarId: 'primary'
          // missing eventId and event object
        }
      };

      await expect(calendarTool.execute(params)).rejects.toThrow('Missing required parameter');
    });

    it('should validate required parameters for deleteEvent', async () => {
      const params: ToolParams = {
        action: 'deleteEvent',
        parameters: {
          calendarId: 'primary'
          // missing eventId
        }
      };

      await expect(calendarTool.execute(params)).rejects.toThrow('Missing required parameter');
    });
  });
}); 