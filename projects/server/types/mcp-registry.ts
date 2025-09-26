// Types for the official MCP Registry API
// Based on: registry-openapi.yaml

export interface Argument {
  choices?: string[] | null;
  default?: string;
  description?: string;
  format?: string;
  isRepeated?: boolean;
  isRequired?: boolean;
  isSecret?: boolean;
  name?: string;
  type: string;
  value?: string;
  valueHint?: string;
  variables?: Record<string, Input>;
}

export interface Input {
  choices?: string[] | null;
  default?: string;
  description?: string;
  format?: string;
  isRequired?: boolean;
  isSecret?: boolean;
  value?: string;
}

export interface KeyValueInput {
  choices?: string[] | null;
  default?: string;
  description?: string;
  format?: string;
  isRequired?: boolean;
  isSecret?: boolean;
  name: string;
  value?: string;
  variables?: Record<string, Input>;
}

export interface Metadata {
  count: number;
  next_cursor?: string;
}

export interface Package {
  environmentVariables?: KeyValueInput[] | null;
  fileSha256?: string;
  identifier: string;
  packageArguments?: Argument[] | null;
  registryBaseUrl?: string;
  registryType: string;
  runtimeArguments?: Argument[] | null;
  runtimeHint?: string;
  transport?: Transport;
  version: string;
}

export interface RegistryExtensions {
  isLatest: boolean;
  publishedAt: string;
  serverId: string;
  updatedAt?: string;
  versionId: string;
}

export interface Repository {
  id?: string;
  source: string;
  subfolder?: string;
  url: string;
}

export interface ServerJSON {
  $schema?: string;
  _meta?: ServerMeta;
  description: string;
  name: string;
  packages?: Package[] | null;
  remotes?: Transport[] | null;
  repository?: Repository;
  status?: string;
  version: string;
  websiteUrl?: string;
}

export interface ServerListResponse {
  metadata: Metadata;
  servers?: ServerJSON[] | null;
}

export interface ServerMeta {
  'io.modelcontextprotocol.registry/official'?: RegistryExtensions;
  'io.modelcontextprotocol.registry/publisher-provided'?: Record<string, any>;
}

export interface Transport {
  headers?: KeyValueInput[] | null;
  type: string;
  url?: string;
}

export interface ErrorDetail {
  location?: string;
  message?: string;
  value?: any;
}

export interface ErrorModel {
  detail?: string;
  errors?: ErrorDetail[] | null;
  instance?: string;
  status?: number;
  title?: string;
  type?: string;
}

// Query parameters for the list-servers endpoint
export interface ListServersParams {
  cursor?: string; // UUID pagination cursor
  limit?: number; // Number of items per page (1-100, default: 30)
  updated_since?: string; // RFC3339 datetime filter
  search?: string; // Search servers by name (substring match)
  version?: string; // Filter by version ('latest' or exact version like '1.2.3')
}

// Response types for our internal API
export interface McpRegistryFilters {
  search?: string;
  version?: string;
  updated_since?: string;
  cursor?: string;
  limit?: number;
}

export interface McpRegistrySearchResult {
  servers: ServerJSON[];
  metadata: Metadata & {
    filtered?: number; // Number of servers after filtering
  };
}
