import { ToolParams, ToolResult } from '../../types';
import { GoogleTool } from './base';

interface EmailMessage {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    mimeType: string;
  }>;
}

export class GmailTool extends GoogleTool {
  private readonly API_BASE = 'https://gmail.googleapis.com/gmail/v1';

  async execute(params: ToolParams): Promise<ToolResult> {
    await this.validate(params);

    try {
      switch (params.action) {
        case 'sendEmail':
          return await this.sendEmail(params.parameters);
        case 'listEmails':
          return await this.listEmails(params.parameters);
        case 'getEmail':
          return await this.getEmail(params.parameters);
        case 'deleteEmail':
          return await this.deleteEmail(params.parameters);
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
      sendEmail: ['to', 'subject', 'body'],
      listEmails: ['maxResults'],
      getEmail: ['messageId'],
      deleteEmail: ['messageId']
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

  private async sendEmail(params: Record<string, unknown>): Promise<ToolResult> {
    const message: EmailMessage = {
      to: Array.isArray(params.to) ? params.to : [params.to as string],
      subject: params.subject as string,
      body: params.body as string
    };

    if (params.cc) {
      message.cc = Array.isArray(params.cc) ? params.cc : [params.cc as string];
    }

    if (params.bcc) {
      message.bcc = Array.isArray(params.bcc) ? params.bcc : [params.bcc as string];
    }

    if (params.attachments) {
      message.attachments = params.attachments as EmailMessage['attachments'];
    }

    const response = await fetch(`${this.API_BASE}/users/me/messages/send`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        raw: this.createRawEmail(message)
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  }

  private async listEmails(params: Record<string, unknown>): Promise<ToolResult> {
    const queryParams = new URLSearchParams({
      maxResults: (params.maxResults as string) || '10',
      ...(params.query ? { q: params.query as string } : {})
    });

    const response = await fetch(
      `${this.API_BASE}/users/me/messages?${queryParams}`,
      {
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list emails: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.messages
    };
  }

  private async getEmail(params: Record<string, unknown>): Promise<ToolResult> {
    const response = await fetch(
      `${this.API_BASE}/users/me/messages/${params.messageId}`,
      {
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get email: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data
    };
  }

  private async deleteEmail(params: Record<string, unknown>): Promise<ToolResult> {
    const response = await fetch(
      `${this.API_BASE}/users/me/messages/${params.messageId}`,
      {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete email: ${response.statusText}`);
    }

    return {
      success: true
    };
  }

  private createRawEmail(message: EmailMessage): string {
    // TODO: Implement MIME message creation
    // This is a placeholder - actual implementation would create proper MIME message
    const mimeMessage = [
      `From: me`,
      `To: ${message.to.join(', ')}`,
      message.cc ? `Cc: ${message.cc.join(', ')}` : '',
      message.bcc ? `Bcc: ${message.bcc.join(', ')}` : '',
      `Subject: ${message.subject}`,
      '',
      message.body
    ].filter(Boolean).join('\r\n');

    return Buffer.from(mimeMessage).toString('base64url');
  }
} 