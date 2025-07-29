import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio';
import { McpClient, McpClientBase } from '@/lib/services/mcpClient';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

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
            stderr: 'pipe'
        });
    }
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

    const client = new McpClientStdio({
      command: serverData.config.command,
      args: serverData.config.args,
      env: serverData.config.env
    });

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