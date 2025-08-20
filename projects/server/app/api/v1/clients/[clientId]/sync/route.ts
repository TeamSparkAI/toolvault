import { NextRequest, NextResponse } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { syncClient, SyncOptions } from '@/lib/services/clientSyncService';
import { BridgeManager } from '@/lib/bridge/BridgeManager';
import { logger } from '@/lib/logging/server';

export async function POST(
    request: NextRequest,
    { params }: { params: { clientId: string } }
): Promise<NextResponse> {
    try {
        const clientId = parseInt(params.clientId);
        if (isNaN(clientId)) {
            return JsonResponse.errorResponse(400, 'Invalid client ID');
        }

        const options: SyncOptions = await request.json();
        const { scan = false, import: importServers = false, convert = false, update = false, serverIds } = options;

        // Validate that at least one operation is requested
        if (!scan && !importServers && !convert && !update) {
            return JsonResponse.errorResponse(400, 'At least one operation must be specified (scan, import, convert, or update)');
        }

        logger.debug('[syncClient] clientId:', clientId);
        logger.debug('[syncClient] options:', options);
        if (serverIds) {
            logger.debug('[syncClient] serverIds:', serverIds);
        }

        const modelFactory = ModelFactory.getInstance();
        const clientModel = await modelFactory.getClientModel();
        const client = await clientModel.findById(clientId);
        if (!client) {
            return JsonResponse.errorResponse(404, 'Client not found');
        }

        const response = await syncClient(client, options);
        logger.debug('[syncClient] response:', response);

        // Add new managed servers to the bridge after conversion
        if (convert && response.convertResults && response.convertResults.length > 0) {
            const bridgeManager = BridgeManager.getInstance();
            const serverModel = await modelFactory.getServerModel();
            for (const convertResult of response.convertResults) {
                if (convertResult.managedServer.isNew) {
                    // Add the new managed server to the bridge
                    const server = await serverModel.findById(convertResult.managedServer.serverId);
                    if (server) {
                        logger.debug('[syncClient] Adding new managed server to bridge:', server.name);
                        await bridgeManager.addClientEndpoint(server);
                    }
                }
            }
        }

        return JsonResponse.payloadResponse('sync', response);
    } catch (error) {
        logger.error('Error in client sync:', error);
        return JsonResponse.errorResponse(500, 'Internal server error');
    }
}