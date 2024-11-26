import { Tool, ToolConfig, ToolParams, ToolResult } from '../../types';
import { CredentialManager, OAuth2Credential } from '../../credential-manager';
import { ToolRegistryError } from '../../../errors';

export abstract class GoogleTool implements Tool {
  protected credential?: OAuth2Credential;
  
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly version: string,
    protected readonly credentialManager: CredentialManager,
    protected readonly credentialId: string
  ) {}

  async configure(config: ToolConfig): Promise<void> {
    try {
      const credential = await this.credentialManager.get(this.credentialId);
      if (credential.type !== 'oauth2') {
        throw new Error('Google tools require OAuth2 credentials');
      }
      this.credential = credential as OAuth2Credential;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ToolRegistryError(`Failed to configure ${this.name}: ${message}`);
    }
  }

  abstract execute(params: ToolParams): Promise<ToolResult>;

  async validate(params: ToolParams): Promise<boolean> {
    if (!this.credential) {
      throw new ToolRegistryError(`${this.name} not configured`);
    }
    return true;
  }

  async handleError(error: Error): Promise<void> {
    // Log error and potentially refresh token if it's an auth error
    if (error.message.includes('invalid_token') || error.message.includes('expired_token')) {
      await this.refreshCredentials();
    }
  }

  protected async refreshCredentials(): Promise<void> {
    if (!this.credential) return;
    
    try {
      const refreshedCredential = await this.credentialManager.get(this.credentialId);
      if (refreshedCredential.type !== 'oauth2') {
        throw new Error('Invalid credential type');
      }
      this.credential = refreshedCredential as OAuth2Credential;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ToolRegistryError(`Failed to refresh credentials: ${message}`);
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (!this.credential) {
      throw new ToolRegistryError('Tool not configured');
    }
    return {
      'Authorization': `Bearer ${this.credential.data.accessToken}`,
      'Content-Type': 'application/json'
    };
  }
} 