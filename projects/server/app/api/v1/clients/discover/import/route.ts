import { NextRequest, NextResponse } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { syncClient, SyncOptions } from '@/lib/services/clientSyncService';
import { DiscoveredClient } from '@/lib/services/clientDiscoveryService';
import { BridgeManager } from '@/lib/bridge/BridgeManager';
import { logger } from '@/lib/logging/server';

export interface ImportRequest {
  clients: DiscoveredClient[];
  convertToManaged: boolean;
  runInContainer: boolean;
  autoUpdate: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ImportRequest = await request.json();
    const {
      clients,
      autoUpdate = true,
      convertToManaged = false,
      runInContainer = false
    } = body;

    if (!clients || clients.length === 0) {
      return JsonResponse.errorResponse(400, 'No clients provided');
    }

    logger.debug('[client-discovery] Importing clients:', clients.map(c => c.configPath));
    
    const modelFactory = ModelFactory.getInstance();
    const clientModel = await modelFactory.getClientModel();
    let importedCount = 0;

    for (const discovered of clients) {
      try {
        const scope = discovered.isGlobal ? 'global' : 'project';
        const client = await clientModel.create({
          type: discovered.clientType,
          name: discovered.name,
          description: discovered.description || `Discovered client at ${discovered.configPath}`,
          configPath: discovered.configPath,
          autoUpdate: autoUpdate,
          enabled: true,
          scope
        });

        logger.debug(`[client-discovery] Created client: ${client.name} (${client.clientId})`);

        // Perform initial scan and import, optionally convert services (to managed, with wrapping), and optionally pushing those conversions (if autoUpdate)
        const syncOptions: SyncOptions = {
          scan: true,
          import: true,
          convert: convertToManaged,
          convertWrapping: runInContainer,
          update: convertToManaged && autoUpdate // The only updates on import would be converted services
        };

        const result = await syncClient(client, syncOptions);
        if (convertToManaged && result.convertResults && result.convertResults.length > 0) {
          const bridgeManager = BridgeManager.getInstance();
          const serverModel = await modelFactory.getServerModel();
          for (const convertResult of result.convertResults) {
            if (convertResult.managedServer.isNew) {
              // Add the new managed server to the bridge
              const server = await serverModel.findById(convertResult.managedServer.serverId);
              if (server) {
                await bridgeManager.addClientEndpoint(server);
              }
            }
          }
        }
        
        importedCount++;
      } catch (error) {
        logger.error(`[client-discovery] Error importing client at ${discovered.configPath}:`, error);
        // Continue with other clients even if one fails
      }
    }

    return JsonResponse.payloadResponse('import', {
      success: true,
      importedCount,
      totalRequested: clients.length
    });
  } catch (error) {
    logger.error('Error in client discovery import:', error);
    return JsonResponse.errorResponse(500, 'Internal server error');
  }
}