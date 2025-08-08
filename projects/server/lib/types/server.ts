import { ClientType } from "./clientType";

export type ServerSecurity = 'network' | 'container' | 'wrapped' | 'unmanaged' | null;

export type McpServerConfigType = 'stdio' | 'sse' | 'streamable';

export type McpServerConfig = 
  | { type: 'stdio'; command: string; args: string[]; env?: Record<string, string>, cwd?: string }
  | { type: 'sse'; url: string; headers?: Record<string, string> }
  | { type: 'streamable'; url: string; headers?: Record<string, string> };

export interface Server {
  serverId: number;
  token: string;
  name: string;
  description?: string;
  config: McpServerConfig;
  enabled: boolean;
  security?: ServerSecurity;
  serverCatalogId?: string;
  serverCatalogIcon?: string;
  status: {
    serverInfo?: {
      name: string;
      version: string;
    } | null;
    lastSeen: string | null;
  };
  clientOwner?: {
    clientId: number;
    name: string;
    description?: string;
    type: ClientType;
  } | null;
  lastSynced?: string | null;
}