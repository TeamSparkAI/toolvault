// Types for the "generic" MCP Registry API (that the standard MCP Registry API implements also)
// Based on: registry-api-openapi.yaml (with some tweaks, it was missing package.transport)

// Base input interface with common properties
export interface Input {
  description?: string;
  isRequired?: boolean;
  format?: 'string' | 'number' | 'boolean' | 'filepath';
  value?: string;
  isSecret?: boolean;
  default?: string;
  choices?: string[];
}

// Input with variable substitution support
export interface InputWithVariables extends Input {
  variables?: Record<string, Input>;
}

// Positional argument (value inserted verbatim into command line)
export interface PositionalArgument extends InputWithVariables {
  type: 'positional';
  valueHint?: string;
  isRepeated?: boolean;
}

// Named argument (command-line --flag={value})
export interface NamedArgument extends InputWithVariables {
  type: 'named';
  name: string;
  isRepeated?: boolean;
}

// Union type for all argument types
export type Argument = PositionalArgument | NamedArgument;

// Key-value input for headers and environment variables
export interface KeyValueInput extends InputWithVariables {
  name: string;
}

export interface TransportLocal {
  type: 'stdio';
}
  
export interface TransportRemote {
  type: 'streamable-http' | 'sse';
  url: string;
  headers?: KeyValueInput[];
}
  
export type Transport = TransportLocal | TransportRemote;
  
export interface Package {
  registryType: string;
  registryBaseUrl?: string;
  identifier: string;
  version: string;
  fileSha256?: string;
  transport: Transport;
  runtimeHint?: string;
  runtimeArguments?: Argument[];
  packageArguments?: Argument[];
  environmentVariables?: KeyValueInput[];
}

export interface OfficialRegistryMetadata {
  serverId: string;
  versionId: string;
  publishedAt: string;
  updatedAt: string;
  isLatest: boolean;
}

export interface Repository {
  url: string;
  source: string;
  id: string;
  subfolder?: string;
}

export interface ServerJSON {
  name: string;
  description: string;
  status?: 'active' | 'deprecated';
  repository?: Repository;
  version: string;
  websiteUrl?: string;
  $schema?: string;
  packages?: Package[];
  remotes?: Transport[];
  _meta?: ServerMeta;
}

export interface Metadata {
    count: number;
    next_cursor?: string;
}

// Alias for ServerDetail as used in the API spec
export type ServerDetail = ServerJSON;

export interface ServerListResponse {
  servers: ServerJSON[];
  metadata?: Metadata;
}

export interface ServerMeta {
  'io.modelcontextprotocol.registry/official'?: OfficialRegistryMetadata;
  'io.modelcontextprotocol.registry/publisher-provided'?: Record<string, any>;
  [key: string]: any; // Allow additional extension namespaces
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
