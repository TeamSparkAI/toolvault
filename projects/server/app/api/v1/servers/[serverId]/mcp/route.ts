import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio';
import { McpClient, McpClientBase } from '@/lib/services/mcpClient';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { logger } from '@/lib/logging/server';
import { ServerData } from '@/lib/models/types/server';
import { expandPath, expandPaths } from '../../../../../../../shared/utils/pathExpansion';

export const dynamic = 'force-dynamic';

// !!! We should return the log messages along with the payload (success or error) and the UX should append it to the client side log and display it

interface McpRequest {
  operation: 'ping' | 'tools' | 'call-tool';
  toolName?: string;
  params?: Record<string, unknown>;
}

class McpClientStdio extends McpClientBase implements McpClient {
    private serverParams: StdioServerParameters;

    constructor(serverParams: StdioServerParameters) {
        super();
        this.serverParams = serverParams;
    }

    protected async createTransport(): Promise<Transport> {
        return new StdioClientTransport({
            command: this.serverParams.command,
            args: this.serverParams.args ?? undefined,
            env: this.serverParams.env ?? undefined,
            cwd: this.serverParams.cwd ?? undefined,
            stderr: 'pipe'
        });
    }
}

function getStdioServerParameters(serverData: ServerData): StdioServerParameters {
  if (serverData.config.type !== 'stdio') {
    throw new Error('Only stdio servers are supported for MCP operations');
  }

  const params: StdioServerParameters = {
    command: serverData.config.command,
    args: serverData.config.args,
    env: serverData.config.env,
    cwd: serverData.config.cwd,
  };

  // Expand paths in args, env, and cwd
  if (params.args && params.args.length > 0) {
    params.args = expandPaths(params.args);
  }

  if (params.env) {
      params.env = Object.fromEntries(Object.entries(params.env).map(([key, value]) => [key, expandPath(value)]));
  }

  if (params.cwd) {
      params.cwd = expandPath(params.cwd);
  }

  logger.error('Stdio server parameters:', params);

  return params;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    const serverId = parseInt(params.serverId);
    if (isNaN(serverId)) {
      return JsonResponse.errorResponse(400, 'Invalid server ID');
    }

    const { operation, toolName, params: toolParams } = await request.json() as McpRequest;

    // Get server details
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const serverData = await serverModel.findById(serverId);
    if (!serverData) {
      return JsonResponse.errorResponse(404, 'Server not found');
    }

    if (serverData.security !== 'unmanaged') {
      return JsonResponse.errorResponse(400, 'Only unmanaged servers are supported for MCP operations');
    }

    if (serverData.config.type !== 'stdio') {
      return JsonResponse.errorResponse(400, 'Only stdio servers are supported for MCP operations');
    }

    // OK, we have an existing unmanaged stdio server, so we can proceed

    const client = new McpClientStdio(getStdioServerParameters(serverData));

    await client.connect();

    try {
      switch (operation) {
        case 'ping': {
          const result = await client.ping();
          return JsonResponse.payloadResponse('ping', result);
        }

        case 'tools': {
          return JsonResponse.payloadResponse('tools', client.serverTools);
        }

        case 'call-tool': {
          if (!toolName) {
            return JsonResponse.errorResponse(400, 'Tool name is required for call-tool operation');
          }
          const tool = client.serverTools.find(t => t.name === toolName);
          if (!tool) {
            return JsonResponse.errorResponse(400, `Tool not found: ${toolName}`);
          }
          const result = await client.callTool(tool, toolParams || {});
          return JsonResponse.payloadResponse('call-tool', result);
        }

        default:
          return JsonResponse.errorResponse(400, 'Invalid operation');
      }
    } finally {
      // Always disconnect to clean up resources
      await client.disconnect();
    }
  } catch (error) {
    logger.error('Error in MCP operation:', error);
    return JsonResponse.errorResponse(500, 'Failed to execute MCP operation');
  }
} 