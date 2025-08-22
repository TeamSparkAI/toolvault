import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { BridgeManager } from '@/lib/bridge/BridgeManager';
import { Server } from '@/lib/types/server';
import { syncClient } from '@/lib/services/clientSyncService';
import { logger } from '@/lib/logging/server';
import { PackageExtractionService } from '@/lib/services/packageExtractionService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const messageModel = await ModelFactory.getInstance().getMessageModel();
    const clientServerModel = await ModelFactory.getInstance().getClientServerModel();
    const clientModel = await ModelFactory.getInstance().getClientModel();
    
    const server = await serverModel.findById(parseInt(params.serverId));
    if (!server) {
      return JsonResponse.errorResponse(404, 'Server not found');
    }

    // For unmanaged servers, get client information
    let clientOwner = null;
    let lastSynced = null;
    
    if (server.security === 'unmanaged') {
      const clientServers = await clientServerModel.list({ serverId: server.serverId });
      if (clientServers.length > 0) {
        const clientServer = clientServers[0]; // Unmanaged servers should only have one client
        const client = await clientModel.findById(clientServer.clientId);
        if (client) {
          clientOwner = {
            clientId: client.clientId,
            name: client.name,
            description: client.description,
            type: client.type
          };
          lastSynced = clientServer.updatedAt;
        }
      }
    }

    // Get the most recent initialize message for server info
    //logger.debug('Getting init message for server:', server.serverId);
    const initMessage = await messageModel.list(
      { 
        serverId: server.serverId,
        payloadMethod: 'initialize'
      },
      { sort: 'desc', limit: 1 }
    );
    //logger.debug('Init message query result:', initMessage);

    // Get the most recent message for last seen
    const lastMessage = await messageModel.list(
      { serverId: server.serverId },
      { sort: 'desc', limit: 1 }
    );
    //logger.debug('Last message query result:', lastMessage);

    let serverInfo = null;
    if (initMessage.messages[0]) {
      try {
        const message = await messageModel.findById(initMessage.messages[0].messageId);
        if (message) {
          const result = message?.payloadResult;
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

    const response: Server = {
      serverId: server.serverId,
      token: server.token,
      name: server.name,
      description: server.description,
      config: server.config,
      enabled: server.enabled,
      security: server.security,
      serverCatalogId: server.serverCatalogId,
      serverCatalogIcon: server.serverCatalogIcon,
      status: {
        serverInfo,
        lastSeen: lastMessage.messages[0]?.timestamp || null
      },
      clientOwner,
      lastSynced
    };
    //logger.debug('Server details response:', response);

    return JsonResponse.payloadResponse('server', response);
  } catch (error) {
    logger.error('Error getting MCP server:', error);
    return JsonResponse.errorResponse(500, 'Failed to get MCP server');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const bridgeManager = BridgeManager.getInstance();

  try {
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const requestBody = await request.json();
    const { name, description, config, enabled, security, serverCatalogId, pinningInfo } = requestBody;

    // Get the current server to check if we're keeping the same name
    const currentServer = await serverModel.findById(parseInt(params.serverId));
    if (!currentServer) {
      return JsonResponse.errorResponse(404, 'Server not found');
    }

    // Validation: If pinningInfo is provided (including null), config must also be provided
    if (pinningInfo !== undefined && config === undefined) {
      return JsonResponse.errorResponse(400, 'Config must be provided when pinningInfo is provided');
    }

    // Validation: If both are provided, validate they match
    if (pinningInfo !== undefined && config !== undefined) {
      const analysis = PackageExtractionService.analyzeServerConfig(config);
      
      if (pinningInfo === null) {
        // Explicitly clearing pinning - config must NOT be pinned
        if (analysis.isPinned) {
          return JsonResponse.errorResponse(400, 'Cannot clear pinningInfo when config is pinned');
        }
      } else {
        // Setting pinning info - config must be pinned and match
        if (!analysis.isPinned) {
          return JsonResponse.errorResponse(400, 'Config must be pinned when pinningInfo is provided');
        }
        
        if (analysis.packageInfo?.registry !== pinningInfo.package.registry ||
            analysis.packageInfo?.packageName !== pinningInfo.package.name ||
            analysis.packageInfo?.currentVersion !== pinningInfo.package.version) {
          return JsonResponse.errorResponse(400, 'PinningInfo package reference does not match config');
        }
      }
    }

    // Build update object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description === '' ? null : description;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (security !== undefined) updateData.security = security;
    if (serverCatalogId !== undefined) updateData.serverCatalogId = serverCatalogId === '' ? null : serverCatalogId;

    // Handle config updates
    if (config !== undefined) {
      updateData.config = config;
      
      // If pinningInfo was provided, use it (already validated above)
      if (pinningInfo !== undefined) {
        updateData.pinningInfo = pinningInfo;
      } else {
        // No pinningInfo provided - check if existing pinningInfo still matches
        const analysis = PackageExtractionService.analyzeServerConfig(config);
        if (analysis.isPinned && 
            currentServer.pinningInfo &&
            currentServer.pinningInfo.package.registry === analysis.packageInfo?.registry &&
            currentServer.pinningInfo.package.name === analysis.packageInfo?.packageName &&
            currentServer.pinningInfo.package.version === analysis.packageInfo?.currentVersion) {
          // Keep existing pinningInfo - it still matches
          // Don't update pinningInfo field
        } else {
          // Config changed or no longer pinned - clear pinningInfo
          updateData.pinningInfo = null;
        }
      }
    }

    // Handle explicit pinningInfo updates (when config is not being updated)
    if (pinningInfo !== undefined && config === undefined) {
      updateData.pinningInfo = pinningInfo; // null/empty to clear, or valid pinningInfo
    }

    const server = await serverModel.update(parseInt(params.serverId), updateData);

    // Handle bridge updates based on security changes
    const wasUnmanaged = currentServer.security === 'unmanaged';
    const isUnmanaged = security !== undefined ? security === 'unmanaged' : wasUnmanaged;

    // Are we're changing anything that would impact the bridge...
    if (config !== undefined || security !== undefined || enabled !== undefined) {
      // Remove the endpoint if it was managed
      if (!wasUnmanaged) {
        logger.debug('PUT: Removing manager server from bridge', currentServer.name);
        await bridgeManager.removeClientEndpoint(currentServer);
      }
      
      // Only add back to bridge if not unmanaged
      if (!isUnmanaged) {
        logger.debug('PUT: Adding managed server to bridge', server.name, server.config);
        await bridgeManager.addClientEndpoint(server);
      }
    }

    return JsonResponse.payloadResponse('server', server);
  } catch (error) {
    logger.error('Error updating MCP server:', error);
    return JsonResponse.errorResponse(500, 'Failed to update MCP server');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const bridgeManager = BridgeManager.getInstance();

  try {
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const server = await serverModel.findById(parseInt(params.serverId));
    if (!server) {
      return JsonResponse.errorResponse(404, 'Server not found');
    }

    if (server.security !== 'unmanaged') {
      // Remove from bridge
      logger.debug('DELETE: Removing managed server from bridge', server.name);
      await bridgeManager.removeClientEndpoint(server);
    }

    // For any autoUpdate client with a clientServer relationship to the server, call sync with null serverId
    const clientServerModel = await ModelFactory.getInstance().getClientServerModel();
    const clientModel = await ModelFactory.getInstance().getClientModel();
    const clientServerRelations = await clientServerModel.list({ serverId: parseInt(params.serverId) });

    await serverModel.delete(parseInt(params.serverId));

    for (const relation of clientServerRelations) {
      if (relation.syncState === "add") {
        // If the relationship is an "add", we need to delete the relation (pending add of a server we deleted)
        await clientServerModel.delete(relation.clientServerId);
      } else {
        const client = await clientModel.findById(relation.clientId);
        if (client?.autoUpdate) {
          await syncClient(client, { update: true, serverIds: [null] });
        }
      }
    }

    return JsonResponse.emptyResponse();
  } catch (error) {
    logger.error('Error deleting MCP server:', error);
    return JsonResponse.errorResponse(500, 'Failed to delete MCP server');
  }
} 