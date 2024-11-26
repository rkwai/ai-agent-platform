import { ToolParams, ToolResult } from '../../types';
import { GoogleTool } from './base';

interface DriveFile {
  name: string;
  mimeType: string;
  parents?: string[];
  description?: string;
}

export class GoogleDriveTool extends GoogleTool {
  private readonly API_BASE = 'https://www.googleapis.com/drive/v3';

  async execute(params: ToolParams): Promise<ToolResult> {
    await this.validate(params);

    try {
      switch (params.action) {
        case 'uploadFile':
          return await this.uploadFile(params.parameters);
        case 'downloadFile':
          return await this.downloadFile(params.parameters);
        case 'listFiles':
          return await this.listFiles(params.parameters);
        case 'deleteFile':
          return await this.deleteFile(params.parameters);
        case 'searchFiles':
          return await this.searchFiles(params.parameters);
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
      uploadFile: ['name', 'content', 'mimeType'],
      downloadFile: ['fileId'],
      listFiles: [],
      deleteFile: ['fileId'],
      searchFiles: ['query']
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

  private async uploadFile(params: Record<string, unknown>): Promise<ToolResult> {
    const metadata: DriveFile = {
      name: params.name as string,
      mimeType: params.mimeType as string
    };

    if (params.parents) {
      metadata.parents = Array.isArray(params.parents) 
        ? params.parents 
        : [params.parents as string];
    }

    if (params.description) {
      metadata.description = params.description as string;
    }

    // First, create the file metadata
    const metadataResponse = await fetch(`${this.API_BASE}/files`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!metadataResponse.ok) {
      throw new Error(`Failed to create file: ${metadataResponse.statusText}`);
    }

    const fileData = await metadataResponse.json();

    // Then upload the content
    const contentResponse = await fetch(
      `${this.API_BASE}/files/${fileData.id}/content`,
      {
        method: 'PATCH',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': metadata.mimeType
        },
        body: params.content as string
      }
    );

    if (!contentResponse.ok) {
      throw new Error(`Failed to upload content: ${contentResponse.statusText}`);
    }

    const data = await contentResponse.json();
    return {
      success: true,
      data
    };
  }

  private async downloadFile(params: Record<string, unknown>): Promise<ToolResult> {
    const response = await fetch(
      `${this.API_BASE}/files/${params.fileId}?alt=media`,
      {
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const content = await response.text();
    return {
      success: true,
      data: {
        content,
        mimeType: response.headers.get('Content-Type')
      }
    };
  }

  private async listFiles(params: Record<string, unknown>): Promise<ToolResult> {
    const queryParams = new URLSearchParams({
      pageSize: (params.pageSize as string) || '100',
      ...(params.pageToken ? { pageToken: params.pageToken as string } : {}),
      fields: 'files(id, name, mimeType, size, modifiedTime, parents),nextPageToken'
    });

    const response = await fetch(
      `${this.API_BASE}/files?${queryParams}`,
      {
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  }

  private async deleteFile(params: Record<string, unknown>): Promise<ToolResult> {
    const response = await fetch(
      `${this.API_BASE}/files/${params.fileId}`,
      {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }

    return {
      success: true
    };
  }

  private async searchFiles(params: Record<string, unknown>): Promise<ToolResult> {
    const queryParams = new URLSearchParams({
      q: params.query as string,
      pageSize: (params.pageSize as string) || '100',
      ...(params.pageToken ? { pageToken: params.pageToken as string } : {}),
      fields: 'files(id, name, mimeType, size, modifiedTime, parents),nextPageToken'
    });

    const response = await fetch(
      `${this.API_BASE}/files?${queryParams}`,
      {
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  }
} 