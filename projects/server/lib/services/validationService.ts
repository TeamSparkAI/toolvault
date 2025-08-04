import { ModelFactory } from '../models';
import { AppSettingsData } from '@/lib/models/types/appSettings';
import { ServerData } from '@/lib/models/types/server';
import { ClientData } from '@/lib/models/types/client';
import { logger } from '@/lib/logging/server';

export interface ValidationResult {
  success: boolean;
  error?: string;
  server?: ServerData;
  client?: ClientData;
  settings?: AppSettingsData;
}

export interface ValidationOptions {
  serverToken?: string;
  serverId?: number;
  clientToken?: string;
  clientId?: number;
}

export class ValidationService {
  private static instance: ValidationService;

  private constructor() {}

  public static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  /**
   * Validates server and client access based on app settings and client/server state
   * 
   * @param options - Validation options including serverName/serverToken/serverId and either clientToken or clientId
   * @returns ValidationResult with success status and any error details
   */
  async validate(options: ValidationOptions): Promise<ValidationResult> {
    try {
      const modelFactory = ModelFactory.getInstance();
      const serverModel = await modelFactory.getServerModel();
      const clientModel = await modelFactory.getClientModel();
      const clientServerModel = await modelFactory.getClientServerModel();
      const settingsModel = await modelFactory.getAppSettingsModel();

      // Get app settings
      const settings = await settingsModel.get();

      // Determine server info - prefer serverId if provided, otherwise look up by token
      let server: ServerData | null = null;
      let serverId: number | null = null;

      if (options.serverId) {
        server = await serverModel.findById(options.serverId);
        if (server) {
          serverId = server.serverId;
        }
      } else if (options.serverToken) {
        server = await serverModel.findByToken(options.serverToken);
        if (server) {
          serverId = server.serverId;
        }
      }

      // 1. Server not found
      if (!server) {
        return {
          success: false,
          error: options.serverId ? `Server with ID ${options.serverId} not found` : `Server with token ${options.serverToken} not found`
        };
      }

      // 2. Server disabled
      if (!server.enabled) {
        return {
          success: false,
          error: `Server ${server.name} is disabled`
        };
      }

      // Determine client info - prefer clientId if provided, otherwise look up by token
      let client: ClientData | null = null;
      let clientId: number | null = null;

      if (options.clientId) {
        client = await clientModel.findById(options.clientId);
        if (client) {
          clientId = client.clientId;
        }
      } else if (options.clientToken) {
        client = await clientModel.findByToken(options.clientToken);
        if (client) {
          clientId = client.clientId;
        }
      }

      // 3. Client token not provided when required by setting
      if (settings.requireClientToken && !clientId) {
        return {
          success: false,
          error: 'Client token is required by application settings'
        };
      }

      // If no client provided and not required, validation passes
      if (!clientId) {
        return {
          success: true,
          server,
          settings
        };
      }

      // 4. Client id or token provided and client not found
      if (!client) {
        return {
          success: false,
          error: options.clientId ? `Client with ID ${options.clientId} not found` : `Client with token ${options.clientToken} not found`
        };
      }

      // 5. Client token provided and is test client, skip remaining checks
      // The test client is the ToolVault client with ID 1
      if (client.clientId === 1) {
        return {
          success: true,
          server,
          client,
          settings
        };
      }

      // 6. Client token provided and client disabled
      if (!client.enabled) {
        return {
          success: false,
          error: `Client ${client.name} is disabled`
        };
      }

      // 7. Client token provided, strict server access required by setting, and server not configured for client
      if (settings.strictServerAccess) {
        const clientServer = await clientServerModel.findByClientAndServer(client.clientId, server.serverId);
        if (!clientServer) {
          return {
            success: false,
            error: `Server ${server.name} is not configured for client ${client.name}`
          };
        }
        
        // Check if the server is pending removal (deleteScanned or deletePushed sync states)
        if (clientServer.syncState === 'deleteScanned' || clientServer.syncState === 'deletePushed') {
          return {
            success: false,
            error: `Server ${server.name} is pending removal from client ${client.name}`
          };
        }
      }

      // All validation checks passed
      return {
        success: true,
        server,
        client,
        settings
      };

    } catch (error) {
      logger.error('Validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }
} 