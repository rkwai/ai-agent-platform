import { GoogleDriveTool } from '../drive';
import { ToolParams } from '../../../types';
import { CredentialManager } from '../../../credential-manager';

// Mock fetch globally
global.fetch = jest.fn();

describe('GoogleDriveTool', () => {
  let driveTool: GoogleDriveTool;
  
  beforeEach(async () => {
    const mockCredentialManager = {
      credentials: new Map(),
      encryptionKey: 'test-key',
      get: jest.fn().mockResolvedValue({
        type: 'oauth2',
        data: {
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          scope: 'https://www.googleapis.com/auth/drive.file'
        }
      }),
      store: jest.fn(),
      delete: jest.fn(),
      refreshOAuth2Token: jest.fn(),
      validateCredential: jest.fn(),
      validateOAuth2Credential: jest.fn()
    } as unknown as CredentialManager;

    driveTool = new GoogleDriveTool(
      'drive-1',
      'Google Drive',
      '1.0.0',
      mockCredentialManager,
      'drive-cred-1'
    );

    await driveTool.configure({
      credentials: {
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret'
      },
      settings: {}
    });
    
    // Mock the getAuthHeaders method from base class
    jest.spyOn(driveTool as any, 'getAuthHeaders').mockReturnValue({
      'Authorization': 'Bearer mock-token'
    });
    // Clear fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  describe('uploadFile', () => {
    it('should successfully upload a file', async () => {
      const mockMetadataResponse = { id: 'file-123' };
      const mockContentResponse = { ...mockMetadataResponse, size: '1024' };
      
      // Mock the metadata creation call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMetadataResponse)
      });
      
      // Mock the content upload call
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockContentResponse)
      });

      const params: ToolParams = {
        action: 'uploadFile',
        parameters: {
          name: 'test.txt',
          content: 'Hello World',
          mimeType: 'text/plain',
          parents: ['folder-123']
        }
      };

      const result = await driveTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContentResponse);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(1,
        expect.stringContaining('/files'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle upload failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      });

      const params: ToolParams = {
        action: 'uploadFile',
        parameters: {
          name: 'test.txt',
          content: 'Hello World',
          mimeType: 'text/plain'
        }
      };

      const result = await driveTool.execute(params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create file');
    });
  });

  describe('downloadFile', () => {
    it('should successfully download a file', async () => {
      const mockContent = 'File content';
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockContent),
        headers: new Headers({
          'Content-Type': 'text/plain'
        })
      });

      const params: ToolParams = {
        action: 'downloadFile',
        parameters: {
          fileId: 'file-123'
        }
      };

      const result = await driveTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        content: mockContent,
        mimeType: 'text/plain'
      });
    });
  });

  describe('listFiles', () => {
    it('should successfully list files', async () => {
      const mockResponse = {
        files: [
          { id: 'file1', name: 'test1.txt' },
          { id: 'file2', name: 'test2.txt' }
        ],
        nextPageToken: 'token123'
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const params: ToolParams = {
        action: 'listFiles',
        parameters: {
          pageSize: '2'
        }
      };

      const result = await driveTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/files?'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
    });
  });

  describe('searchFiles', () => {
    it('should successfully search files', async () => {
      const mockResponse = {
        files: [
          { id: 'file1', name: 'match1.txt' },
          { id: 'file2', name: 'match2.txt' }
        ]
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const params: ToolParams = {
        action: 'searchFiles',
        parameters: {
          query: 'name contains "match"'
        }
      };

      const result = await driveTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/files\?.*q=name\+contains\+%22match%22/),
        expect.any(Object)
      );
    });
  });

  describe('deleteFile', () => {
    it('should successfully delete a file', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const params: ToolParams = {
        action: 'deleteFile',
        parameters: {
          fileId: 'file-123'
        }
      };

      const result = await driveTool.execute(params);
      
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-123'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('validation', () => {
    it('should validate required parameters for uploadFile', async () => {
      const params: ToolParams = {
        action: 'uploadFile',
        parameters: {
          name: 'test.txt',
          // missing content and mimeType
        }
      };

      await expect(driveTool.execute(params)).rejects.toThrow('Missing required parameter');
    });

    it('should validate required parameters for downloadFile', async () => {
      const params: ToolParams = {
        action: 'downloadFile',
        parameters: {} // missing fileId
      };

      await expect(driveTool.execute(params)).rejects.toThrow('Missing required parameter');
    });

    it('should validate required parameters for searchFiles', async () => {
      const params: ToolParams = {
        action: 'searchFiles',
        parameters: {} // missing query
      };

      await expect(driveTool.execute(params)).rejects.toThrow('Missing required parameter');
    });
  });
}); 