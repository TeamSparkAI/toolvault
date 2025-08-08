import { ServerEndpoint, startBridge, ServerEndpointConfig, ClientEndpointConfig, AuthorizedMessageProcessor, ClientEndpointLogEntry } from 'toolvault-bridge';
import { ModelFactory } from '../models';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { MessageFilterService } from '../services/messageFilter';
import { JsonRpcMessageWrapper } from '../jsonrpc';
import { ProxyJwtPayload, verifyProxyToken } from '../proxyJwt';
import { ValidationService } from '../services/validationService';
import { ServerData } from '../models/types/server';
import { logger } from '../logging/server';

// Use a global variable to ensure singleton persistence across module reloads
declare global {
  var bridgeManagerInstance: BridgeManager | null;
}

if (!global.bridgeManagerInstance) {
  global.bridgeManagerInstance = null;
}

export class BridgeManager {
  private bridge: ServerEndpoint | null = null;
  private messageProcessor: AuthorizedMessageProcessor;
  private actualPort: number | null = null;

  // The "serverName" params below represent the path element in the URL (not necessarily the server name).  In our case, this
  // is the server token.
  //
  private constructor() {
    this.messageProcessor = {
      authorize: async (serverName: string, authHeader: string) => {
        logger.debug('Authorizing message:', authHeader);
        if (!authHeader?.startsWith('Bearer ')) {
          logger.debug('No bearer token found');
          throw new Error('No bearer token found');
        }

        const token = authHeader.split(' ')[1];
        let payload;
        try {
          payload = verifyProxyToken(token);
          if (payload.serverToken !== serverName) {
            logger.debug('Server name mismatch:', payload.serverToken, serverName);
            throw new Error('Server name mismatch');
          }
        } catch (err) {
          logger.debug('Invalid bearer token');
          throw new Error('Invalid bearer token');
        }

        // Additional validation using the shared validation service
        const validationService = ValidationService.getInstance();
        
        // Use the clientId from the JWT payload directly
        const validationResult = await validationService.validate({serverToken:serverName, clientId: payload.clientId || undefined});
        if (!validationResult.success) {
          logger.debug('Validation failed:', validationResult.error);
          throw new Error(validationResult.error || 'Validation failed');
        }

        return payload;
      },
      forwardMessageToServer: async (serverName: string, sessionId: string, message: JSONRPCMessage, authPayload: any) => {
        logger.debug(`Forwarding message to server (server: ${serverName}, sessionId: ${sessionId}):`, message);
        const proxyAuthPayload = authPayload as ProxyJwtPayload;
        const messageWrapper = new JsonRpcMessageWrapper("client", message);
        const result = await MessageFilterService.processMessage(proxyAuthPayload, sessionId, messageWrapper);
        return result.message;
      },
      returnMessageToClient: async (serverName: string, sessionId: string, message: JSONRPCMessage, authPayload: any) => {
        logger.debug(`Returning message to client (server: ${serverName}, sessionId: ${sessionId}):`, message);
        const proxyAuthPayload = authPayload as ProxyJwtPayload;
        const messageWrapper = new JsonRpcMessageWrapper("server", message);
        const result = await MessageFilterService.processMessage(proxyAuthPayload, sessionId, messageWrapper);
        return result.message;
      }
    };
  }

  public static getInstance(): BridgeManager {
    if (!global.bridgeManagerInstance) {
      logger.debug('Creating BridgeManager instance');
      global.bridgeManagerInstance = new BridgeManager();
    }
    return global.bridgeManagerInstance;
  }

  public getActualPort(): number | null {
    return this.actualPort;
  }

  private async createClientEndpoint(server: { name: string; config: any }): Promise<ClientEndpointConfig> {
    switch (server.config.type) {
      case 'stdio':
        return {
          name: server.name,
          mode: 'stdio',
          command: server.config.command,
          args: server.config.args,
          env: server.config.env,
          cwd: server.config.cwd,
        };
      case 'sse':
        return {
          name: server.name,
          mode: 'sse',
          endpoint: server.config.url,
          endpointHeaders: server.config.headers,
        };
      case 'streamable':
        return {
          name: server.name,
          mode: 'streamable',
          endpoint: server.config.url,
          endpointHeaders: server.config.headers,
        };
      default:
        throw new Error(`Unknown server type: ${server.config.type}`);
    }
  }

  public async start(): Promise<void> {
    logger.debug('Starting bridge');
    if (this.bridge) {
      logger.debug('Bridge already running');
      return;
    }

    const hostModel = await ModelFactory.getInstance().getHostModel();
    const mcpHost = await hostModel.get();
    logger.debug('Debug - MCP host config:', JSON.stringify(mcpHost, null, 2));
    if (!mcpHost) {
      logger.debug('No MCP host config found, not starting MCP bridge');
      return;
    }

    const mcpServerEndpoint: ServerEndpointConfig = {
      mode: mcpHost.type,
      host: mcpHost.host,
      port: mcpHost.port,
    };

    const serverModel = await ModelFactory.getInstance().getServerModel();
    const { servers } = await serverModel.list({enabled: true}, { limit: 1000, sort: 'asc' });
    const mcpClientEndpoints: ClientEndpointConfig[] = await Promise.all(
      servers
        .filter(server => server.security !== 'unmanaged')
        .map(server => this.createClientEndpoint({ name: server.token, config: server.config }))
    );

    logger.debug('Starting MCP Bridge with endpoints:', mcpClientEndpoints);

    this.bridge = await startBridge(mcpServerEndpoint, mcpClientEndpoints, this.messageProcessor, logger.getCurrentLogLevel());
    
    // Capture the actual port if it was auto-assigned (port 0)
    if (this.bridge && mcpHost.port === 0) {
      // Get the actual port from the bridge object
      try {
        const bridgeAny = this.bridge as any;
        if (bridgeAny.port) {
          this.actualPort = bridgeAny.port;
        } else {
          logger.debug('Bridge started with auto-assigned port, actual port not determined');
        }
      } catch (error) {
        logger.debug('Could not determine actual bridge port:', error);
      }
    } else {
      this.actualPort = mcpHost.port;
    }
    
    logger.debug('MCP Bridge started on port:', this.actualPort);
  }

  public async restart(): Promise<void> { 
    logger.debug('Restarting MCP Bridge');
    await this.stop();
    await this.start();
  }

  public async stop(): Promise<void> {
    if (!this.bridge) {
      logger.debug('Bridge not running');
      return;
    }

    logger.debug('Stopping MCP Bridge');
    await this.bridge.stop(false); // don't trigger process termination
    this.bridge = null;
    this.actualPort = null;
    logger.debug('MCP Bridge stopped');
  }

  public async addClientEndpoint(server: ServerData): Promise<void> {
    logger.debug('Adding client endpoint:', server.token);
    if (!this.bridge) {
      logger.debug('Bridge not running');
      return;
    }

    const clientEndpoint = await this.createClientEndpoint({ name: server.token, config: server.config });
    await this.bridge.addClientEndpoint(server.token, clientEndpoint);
    logger.debug('Added client endpoint:', server.token);
  }

  public async removeClientEndpoint(server: ServerData): Promise<void> {
    logger.debug('Removing client endpoint:', server.token);
    if (!this.bridge) {
      logger.debug('Bridge not running');
      return;
    }

    await this.bridge.removeClientEndpoint(server.token);
    logger.debug('Removed client endpoint:', server.token);
  }

  public isRunning(): boolean {
    return this.bridge !== null;
  }

  public async getStatus(): Promise<{ running: boolean; configuration: { host: ServerEndpointConfig | null; actualPort: number | null } }> {
    const hostModel = await ModelFactory.getInstance().getHostModel();
    const mcpHost = await hostModel.get();
    
    if (!mcpHost) {
      return {
        running: this.isRunning(),
        configuration: { host: null, actualPort: null }
      };
    }

    const hostConfig: ServerEndpointConfig = {
      mode: mcpHost.type,
      host: mcpHost.host,
      port: mcpHost.port,
    };

    return {
      running: this.isRunning(),
      configuration: { 
        host: hostConfig,
        actualPort: this.actualPort
      }
    };
  }

  public async getClientConfigs(): Promise<ClientEndpointConfig[]> {
    if (!this.bridge) {
      return [];
    }

    const serverModel = await ModelFactory.getInstance().getServerModel();
    const { servers } = await serverModel.list({enabled: true}, { limit: 1000, sort: 'asc' });
    
    const clientConfigs: ClientEndpointConfig[] = await Promise.all(
      servers
        .filter(server => server.security !== 'unmanaged')
        .map(server => this.createClientEndpoint({ name: server.token, config: server.config }))
    );

    return clientConfigs;
  }

  public async getClientLogs(server: string): Promise<ClientEndpointLogEntry[]> {
    if (!this.bridge) {
      return [];
    }

    try {
      // Get the client endpoint from the bridge
      const clientEndpoint = this.bridge.getClientEndpoint(server);
      if (!clientEndpoint) {
        return [];
      }
      return clientEndpoint.getLogEvents();
    } catch (error) {
      logger.error('Error getting client logs:', error);
      return [];
    }
  }
}