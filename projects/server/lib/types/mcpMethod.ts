export interface McpServer {
  name: string;
  status: 'running' | 'stopped' | 'error';
  url: string;
  lastSeen: string;
  version: string;
  config: {
    type: 'stdio' | 'sse';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
  };
}

export interface McpMethod {
  value: string;
  description: string;
  direction: 'client-to-server' | 'server-to-client';
  category: string;
}

export const MCP_METHODS: McpMethod[] = [
  // Connection Management
  {
    value: 'initialize',
    description: 'Client initiated, starts the handshake and connection.',
    direction: 'client-to-server',
    category: 'Connection Management'
  },
  {
    value: 'initialized',
    description: 'Client initiated, notification that initialization is complete.',
    direction: 'client-to-server',
    category: 'Connection Management'
  },
  {
    value: 'shutdown',
    description: 'Client initiated, gracefully terminates the connection.',
    direction: 'client-to-server',
    category: 'Connection Management'
  },

  // Tools
  {
    value: 'tools/list',
    description: 'Client initiated, requests a list of all available tools/functions the server provides.',
    direction: 'client-to-server',
    category: 'Tools'
  },
  {
    value: 'tools/call',
    description: 'Client initiated, requests the server to execute a specific tool/function.',
    direction: 'client-to-server',
    category: 'Tools'
  },

  // Resources
  {
    value: 'resources/list',
    description: 'Client initiated, requests a list of available data resources/contexts the server can provide.',
    direction: 'client-to-server',
    category: 'Resources'
  },
  {
    value: 'resources/read',
    description: 'Client initiated, requests the content of a specific resource.',
    direction: 'client-to-server',
    category: 'Resources'
  },

  // Prompts
  {
    value: 'prompts/list',
    description: 'Client initiated, requests a list of available prompt templates.',
    direction: 'client-to-server',
    category: 'Prompts'
  },
  {
    value: 'prompts/get',
    description: 'Client initiated, requests the content of a specific prompt.',
    direction: 'client-to-server',
    category: 'Prompts'
  },

  // Sampling
  {
    value: 'sampling/createMessage',
    description: 'Client initiated, sends a message for AI model sampling/inference.',
    direction: 'client-to-server',
    category: 'Sampling'
  },

  // Notifications (Server to Client)
  {
    value: 'notifications/message', // Also seen notifications/stderr from everything, but that appears to be non-standard
    description: 'Server to client, a structured logging event message.',
    direction: 'server-to-client',
    category: 'Notifications'
  },
  {
    value: 'notifications/progress',
    description: 'Server to client, a notification about the progress of a long-running operation.',
    direction: 'server-to-client',
    category: 'Notifications'
  },
  {
    value: 'notifications/tools/list_changed',
    description: 'Server to client, notification that the list of tools has changed.',
    direction: 'server-to-client',
    category: 'Notifications'
  },
  {
    value: 'notifications/resources/list_changed',
    description: 'Server to client, notification that the list of resources has changed.',
    direction: 'server-to-client',
    category: 'Notifications'
  }
];

export const MCP_METHODS_BY_CATEGORY = MCP_METHODS.reduce((acc, method) => {
  if (!acc[method.category]) {
    acc[method.category] = [];
  }
  acc[method.category].push(method);
  return acc;
}, {} as Record<string, McpMethod[]>);

export const MCP_METHOD_VALUES = MCP_METHODS.map(method => method.value);

export const CLIENT_TO_SERVER_METHODS = MCP_METHODS.filter(method => method.direction === 'client-to-server');
export const SERVER_TO_CLIENT_METHODS = MCP_METHODS.filter(method => method.direction === 'server-to-client');

export function getMcpMethod(value: string): McpMethod | undefined {
  return MCP_METHODS.find(method => method.value === value);
}

export function getMcpMethodsByCategory(category: string): McpMethod[] {
  return MCP_METHODS_BY_CATEGORY[category] || [];
}

export function getMcpMethodCategories(): string[] {
  return Object.keys(MCP_METHODS_BY_CATEGORY);
} 