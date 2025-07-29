import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { BridgeManager } from '@/lib/bridge/BridgeManager';
import { logger } from '@/lib/logging/server';
import { ServerData } from '@/lib/models/types/server';

export const dynamic = 'force-dynamic';

export type ServerInfo = {
  name: string;
  version: string;
};

export type ServerWithStatus = ServerData & {
  status: {
    serverInfo: ServerInfo | null;
    lastSeen: string | null;
  };
};

export async function GET(request: NextRequest) {
  try {
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const messageModel = await ModelFactory.getInstance().getMessageModel();
    
    const url = new URL(request.url);
    const managedParam = url.searchParams.get('managed');
    const managed = managedParam !== null ? managedParam === 'true' : undefined;
    
    const { servers } = await serverModel.list({ managed }, { sort: 'asc', limit: 100 });
    
    // Transform the servers array to include status
    const serversWithStatus: ServerWithStatus[] = await Promise.all(
      servers.map(async (server) => {
        // Get the most recent initialize message for server info
        const initMessage = await messageModel.list(
          { 
            serverId: server.serverId,
            payloadMethod: 'initialize'
          },
          { sort: 'desc', limit: 1 }
        );

        // Get the most recent message for last seen
        const lastMessage = await messageModel.list(
          { serverId: server.serverId },
          { sort: 'desc', limit: 1 }
        );

        let serverInfo: ServerInfo | null = null;
        if (initMessage.messages[0]) {          
          try {
            const message = await messageModel.findById(initMessage.messages[0].messageId);
            if (message) {
              const result = message.payloadResult;
              if (result && result.serverInfo) {
                serverInfo = {
                  name: result.serverInfo.name,
                  version: result.serverInfo.version
                };
              }
            }
          } catch (e) {
            logger.error('Error parsing initialize message result:', e);
          }
        }

        return {
          serverId: server.serverId,
          name: server.name,
          description: server.description,
          token: server.token,
          createdAt: server.createdAt,
          updatedAt: server.updatedAt,
          config: server.config,
          enabled: server.enabled,
          security: server.security,
          serverCatalogId: server.serverCatalogId,
          serverCatalogIcon: server.serverCatalogIcon,
          status: {
            serverInfo,
            lastSeen: lastMessage.messages[0]?.timestamp || null
          }
        };
      })
    );

    return JsonResponse.payloadResponse('servers', serversWithStatus);
  } catch (error) {
    logger.error('Error listing MCP servers:', error);
    return JsonResponse.errorResponse(500, 'Failed to list MCP servers');
  }
}

export async function POST(request: Request) {
  const bridgeManager = BridgeManager.getInstance();

  try {
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const { name, description, config, enabled, security, serverCatalogId } = await request.json();
    
    const server = await serverModel.create({
      name,
      description,
      config,
      enabled: enabled !== undefined ? enabled : true,
      security: security !== undefined ? security : null,
      serverCatalogId: serverCatalogId || null
    });
    
    // Add to bridge only if not unmanaged
    if (security !== 'unmanaged') {
      logger.debug('POST: Adding managed server to bridge', name, config);
      await bridgeManager.addClientEndpoint(server);
    }
    
    return JsonResponse.payloadResponse('serverId', server.serverId);
  } catch (error) {
    logger.error('Error creating server:', error);
    return JsonResponse.errorResponse(500, 'Failed to add MCP server');
  }
}