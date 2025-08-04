import { HostData } from '@/lib/models/types/host';
import { McpClient, McpClientSse, McpClientStreamable } from './mcpClient';
import { Tool } from '@modelcontextprotocol/sdk/types';
import { JsonResponseFetch } from '../jsonResponse';
import { ClientData } from '@/lib/models/types/client';
import { Server } from '@/lib/types/server';
import { log } from '@/lib/logging/console';

// Base interface that all helpers must implement
export interface IMcpClientHelper {
  ping(): Promise<{ elapsedTimeMs: number }>;
  getTools(): Promise<Tool[]>;
  callTool(toolName: string, params: Record<string, unknown>): Promise<{ result: any; elapsedTimeMs: number }>;
  disconnect(): Promise<void>;
}

// Base class for network-based connections (shared logic)
abstract class NetworkMcpClientHelper implements IMcpClientHelper {
  protected client: McpClient | null = null;
  protected serverId: number;
  protected serverName: string;

  constructor(serverId: number, serverName: string) {
    this.serverId = serverId;
    this.serverName = serverName;
  }

  // Shared implementation for all network-based helpers
  async ping(): Promise<{ elapsedTimeMs: number }> {
    const client = await this.ensureClient();
    return client.ping();
  }

  async getTools(): Promise<Tool[]> {
    const client = await this.ensureClient();
    const connected = await client.connect();
    if (!connected) {
      throw new Error('Failed to connect to MCP server');
    }
    return client.serverTools;
  }

  async callTool(toolName: string, params: Record<string, unknown>): Promise<{ result: any; elapsedTimeMs: number }> {
    const client = await this.ensureClient();
    log.debug('Available tools:', client.serverTools.map(t => t.name));
    const tool = client.serverTools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    return client.callTool(tool, params);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  // Abstract method for connection-specific logic
  protected abstract ensureClient(): Promise<McpClient>;
}

// Network-based implementations
export class HostedMcpClientHelper extends NetworkMcpClientHelper {
  private hostConfig: HostData;
  private serverToken: string;

  constructor(hostConfig: HostData, serverId: number, serverName: string, serverToken: string) {
    super(serverId, serverName);
    this.hostConfig = hostConfig;
    this.serverToken = serverToken;
  }

  protected async ensureClient(): Promise<McpClient> {
    if (!this.client) {
      log.debug('Getting internal client token');
      const internalClientId = 1; // We happen to know that the built-in ToolVault client has id 1
      const clientResponse = await fetch(`/api/v1/clients/${internalClientId}`);
      const clientResponseJson = await clientResponse.json();
      const clientResult = new JsonResponseFetch<ClientData>(clientResponseJson, 'client');
      if (!clientResult.isSuccess()) {
        throw new Error(`Failed to get internal client: ${clientResult.message}`);
      }

      log.debug('Getting server config from proxy endpoint', this.serverName);
      const response = await fetch(`/api/v1/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: 'Test User',
          args: [
            this.serverName + "/" + this.serverToken,
            clientResult.payload.token
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get server config: ${response.statusText}`);
      }

      const { config } = await response.json();

      log.debug('Got server config', config);

      const url = new URL(config.url);
      const headers: Record<string, string> = {};
      if (config.headers) {
        Object.entries(config.headers).forEach(([key, value]) => {
          headers[key] = String(value);
        });
      }

      switch (config.type) {
        case 'sse':
          this.client = new McpClientSse(url, headers);
          break;
        case 'streamable':
          this.client = new McpClientStreamable(url, headers);
          break;
        default:
          throw new Error(`Unsupported MCP host type: ${this.hostConfig.type}`);
      }
    }
    return this.client;
  }
}

export class DirectMcpClientHelper extends NetworkMcpClientHelper {
  protected serverConfig: any;

  constructor(serverConfig: any, serverId: number, serverName: string) {
    super(serverId, serverName);
    this.serverConfig = serverConfig;
  }

  protected async ensureClient(): Promise<McpClient> {
    if (!this.client) {
        log.debug('Creating direct MCP client for unmanaged server', this.serverName);

      switch (this.serverConfig.type) {
        case 'stdio': {
          // Stdio servers are not supported in browser environment
          throw new Error('Stdio servers are not supported for direct connection in browser environment');
        }
        case 'sse': {
          const url = new URL(this.serverConfig.url);
          const headers: Record<string, string> = {};
          if (this.serverConfig.headers) {
            Object.entries(this.serverConfig.headers).forEach(([key, value]) => {
              headers[key] = String(value);
            });
          }
          this.client = new McpClientSse(url, headers);
          break;
        }
        case 'streamable': {
          const url = new URL(this.serverConfig.url);
          const headers: Record<string, string> = {};
          if (this.serverConfig.headers) {
            Object.entries(this.serverConfig.headers).forEach(([key, value]) => {
              headers[key] = String(value);
            });
          }
          this.client = new McpClientStreamable(url, headers);
          break;
        }
        default:
          throw new Error(`Unsupported MCP server type: ${this.serverConfig.type}`);
      }
    }
    return this.client;
  }
}

// API-based implementation (completely separate)
export class ApiMcpClientHelper implements IMcpClientHelper {
  private serverId: number;
  private serverName: string;

  constructor(serverId: number, serverName: string) {
    this.serverId = serverId;
    this.serverName = serverName;
  }

  async ping(): Promise<{ elapsedTimeMs: number }> {
    const response = await fetch(`/api/v1/servers/${this.serverId}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'ping' })
    });
    
    if (!response.ok) {
      throw new Error(`Ping failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.ping;
  }

  async getTools(): Promise<Tool[]> {
    const response = await fetch(`/api/v1/servers/${this.serverId}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'tools' })
    });
    
    if (!response.ok) {
      throw new Error(`Get tools failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.tools;
  }

  async callTool(toolName: string, params: Record<string, unknown>): Promise<{ result: any; elapsedTimeMs: number }> {
    const response = await fetch(`/api/v1/servers/${this.serverId}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        operation: 'call-tool',
        toolName,
        params
      })
    });
    
    if (!response.ok) {
      throw new Error(`Call tool failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data['call-tool'];
  }

  async disconnect(): Promise<void> {
    // No-op for API-based helper
  }
}

// Factory method
export class McpClientHelper {
  static async createForServer(server: Server, hostConfig: HostData): Promise<IMcpClientHelper> {
    if (server.security === 'unmanaged') {
      // For unmanaged servers, check the config type
      if (server.config.type === 'stdio') {
        // For unmanaged stdio servers, use API endpoint (supports stdio)
        return new ApiMcpClientHelper(server.serverId, server.name);
      } else {
        // For unmanaged non-stdio servers (sse/streamable), use direct connection
        return new DirectMcpClientHelper(server.config, server.serverId, server.name);
      }
    } else {
      // For managed servers, use hosted connection
      return new HostedMcpClientHelper(hostConfig, server.serverId, server.name, server.token);
    }
  }
}