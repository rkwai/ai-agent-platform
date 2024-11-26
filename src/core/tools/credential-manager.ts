import { ToolRegistryError } from '../errors';

export interface Credential {
  id: string;
  type: 'oauth2' | 'apiKey' | 'basic';
  data: Record<string, string>;
  metadata: {
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
  };
}

export interface OAuth2Credential extends Credential {
  type: 'oauth2';
  data: {
    accessToken: string;
    refreshToken: string;
    scope: string;
  };
}

export class CredentialManager {
  private credentials: Map<string, Credential> = new Map();
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  async store(credential: Credential): Promise<void> {
    // TODO: Encrypt credential data before storing
    this.credentials.set(credential.id, {
      ...credential,
      metadata: {
        ...credential.metadata,
        updatedAt: new Date()
      }
    });
  }

  async get(credentialId: string): Promise<Credential> {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      throw new ToolRegistryError(`Credential ${credentialId} not found`);
    }

    if (credential.metadata.expiresAt && credential.metadata.expiresAt < new Date()) {
      if (credential.type === 'oauth2') {
        await this.refreshOAuth2Token(credential as OAuth2Credential);
      } else {
        throw new ToolRegistryError(`Credential ${credentialId} has expired`);
      }
    }

    // TODO: Decrypt credential data before returning
    return credential;
  }

  async delete(credentialId: string): Promise<void> {
    if (!this.credentials.has(credentialId)) {
      throw new ToolRegistryError(`Credential ${credentialId} not found`);
    }
    this.credentials.delete(credentialId);
  }

  private async refreshOAuth2Token(credential: OAuth2Credential): Promise<void> {
    // TODO: Implement OAuth2 token refresh logic
    throw new Error('OAuth2 token refresh not implemented');
  }

  async validateCredential(credential: Credential): Promise<boolean> {
    // Basic validation
    if (!credential.id || !credential.type || !credential.data) {
      return false;
    }

    // Type-specific validation
    switch (credential.type) {
      case 'oauth2':
        return this.validateOAuth2Credential(credential as OAuth2Credential);
      case 'apiKey':
        return 'apiKey' in credential.data;
      case 'basic':
        return 'username' in credential.data && 'password' in credential.data;
      default:
        return false;
    }
  }

  private async validateOAuth2Credential(credential: OAuth2Credential): Promise<boolean> {
    return (
      'accessToken' in credential.data &&
      'refreshToken' in credential.data &&
      'scope' in credential.data
    );
  }
} 