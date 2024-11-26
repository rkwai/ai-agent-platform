import { GmailTool } from '../gmail';
import { ToolParams } from '../../../types';
import { CredentialManager } from '../../../credential-manager';

// Mock fetch globally
global.fetch = jest.fn();

describe('GmailTool', () => {
  let gmailTool: GmailTool;
  
  beforeEach(async () => {
    const mockCredentialManager = {
      credentials: new Map(),
      encryptionKey: 'test-key',
      get: jest.fn().mockResolvedValue({
        type: 'oauth2',
        data: {
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          scope: 'https://www.googleapis.com/auth/gmail.modify'
        }
      }),
      store: jest.fn(),
      delete: jest.fn(),
      refreshOAuth2Token: jest.fn(),
      validateCredential: jest.fn(),
      validateOAuth2Credential: jest.fn()
    } as unknown as CredentialManager;

    gmailTool = new GmailTool(
      'gmail-1',
      'Gmail',
      '1.0.0',
      mockCredentialManager,
      'gmail-cred-1'
    );

    await gmailTool.configure({
      credentials: {
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret'
      },
      settings: {}
    });
    
    // Mock the getAuthHeaders method from base class
    jest.spyOn(gmailTool as any, 'getAuthHeaders').mockReturnValue({
      'Authorization': 'Bearer mock-token'
    });
    // Clear fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  describe('sendEmail', () => {
    it('should successfully send an email', async () => {
      const mockResponse = { id: 'message-123' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const params: ToolParams = {
        action: 'sendEmail',
        parameters: {
          to: 'test@example.com',
          subject: 'Test Subject',
          body: 'Test Body'
        }
      };

      const result = await gmailTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/send'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
    });

    it('should handle email sending failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      });

      const params: ToolParams = {
        action: 'sendEmail',
        parameters: {
          to: 'test@example.com',
          subject: 'Test Subject',
          body: 'Test Body'
        }
      };

      const result = await gmailTool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to send email');
    });
  });

  describe('listEmails', () => {
    it('should successfully list emails', async () => {
      const mockResponse = {
        messages: [
          { id: 'msg1', threadId: 'thread1' },
          { id: 'msg2', threadId: 'thread2' }
        ]
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const params: ToolParams = {
        action: 'listEmails',
        parameters: {
          maxResults: '2',
          query: 'in:inbox'
        }
      };

      const result = await gmailTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.messages);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages?'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
    });
  });

  describe('getEmail', () => {
    it('should successfully get email details', async () => {
      const mockResponse = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'Email content'
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const params: ToolParams = {
        action: 'getEmail',
        parameters: {
          messageId: 'msg1'
        }
      };

      const result = await gmailTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages/msg1'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
    });
  });

  describe('validation', () => {
    it('should validate required parameters for sendEmail', async () => {
      const params: ToolParams = {
        action: 'sendEmail',
        parameters: {
          subject: 'Test Subject',
          body: 'Test Body'
          // missing 'to' parameter
        }
      };

      await expect(gmailTool.execute(params)).rejects.toThrow('Missing required parameter');
    });

    it('should validate required parameters for getEmail', async () => {
      const params: ToolParams = {
        action: 'getEmail',
        parameters: {}  // missing messageId
      };

      await expect(gmailTool.execute(params)).rejects.toThrow('Missing required parameter');
    });
  });
}); 