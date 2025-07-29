import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { ClientServerData } from '@/lib/models/types/clientServer';
import { ServerData } from '@/lib/models/types/server';
import { syncClient } from '@/lib/services/clientSyncService';
import { logger } from '@/lib/logging/server';

export type ClientServerRelationshipWithServer = ClientServerData & {
    server: ServerData | null;
};

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { clientId: string } }
) {
    try {
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();
        const serverModel = await ModelFactory.getInstance().getServerModel();

        const clientId = parseInt(params.clientId);
        if (isNaN(clientId)) {
            return JsonResponse.errorResponse(400, 'Invalid client ID');
        }

        // Get all client-server relationships for this client
        const clientServers = await clientServerModel.list({ clientId });

        // Get server details for each relationship
        const serverIds = clientServers.map(cs => cs.serverId).filter((id): id is number => id !== null);
        const servers = await serverModel.getByIds(serverIds);

        const relationshipsWithServerDetails: ClientServerRelationshipWithServer[] = clientServers.map((clientServer) => {
            const server = servers.find(s => s.serverId === clientServer.serverId);
            return {
                ...clientServer,
                server: server ? {
                    serverId: server.serverId,
                    token: server.token,
                    name: server.name,
                    description: server.description,
                    config: server.config,
                    enabled: server.enabled,
                    security: server.security,
                    createdAt: server.createdAt,
                    updatedAt: server.updatedAt
                } : null
            };
        });

        return JsonResponse.payloadResponse('relationships', relationshipsWithServerDetails);
    } catch (error) {
        logger.error('Error getting client-server relationships:', error);
        return JsonResponse.errorResponse(500, 'Failed to get client-server relationships');
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { clientId: string } }
) {
    try {
        const clientModel = await ModelFactory.getInstance().getClientModel();
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();

        const clientId = parseInt(params.clientId);
        if (isNaN(clientId)) {
            return JsonResponse.errorResponse(400, 'Invalid client ID');
        }

        const client = await clientModel.findById(clientId);
        if (!client) {
            return JsonResponse.errorResponse(404, 'Client not found');
        }

        const body = await request.json();
        const serverIds = Array.isArray(body) ? body : [body];

        if (!serverIds.every(id => typeof id === 'number' && !isNaN(id))) {
            return JsonResponse.errorResponse(400, 'Invalid server IDs provided');
        }

        const relationships: ClientServerData[] = [];

        for (const serverId of serverIds) {
            // Check if relationship already exists
            const existingRelationship = await clientServerModel.findByClientAndServer(clientId, serverId);

            if (existingRelationship) {
                // Skip existing relationships
                continue;
            }

            // Create new relationship
            const newRelationship = await clientServerModel.create({
                clientId,
                serverId,
                clientServerName: null,
                syncState: "add"
            });

            relationships.push(newRelationship);
        }

        if (client.autoUpdate && relationships.length > 0) {
            const relationshipServerIds = relationships.map(r => r.serverId).filter((id): id is number => id !== null);
            await syncClient(client, { update: true, serverIds: relationshipServerIds });

            // Re-fetch relationships to get updated syncState
            const updatedRelationships = await Promise.all(
                relationships.map(r => clientServerModel.findById(r.clientServerId))
            );

            return JsonResponse.payloadResponse('relationships', updatedRelationships.filter(r => r !== null));
        }

        return JsonResponse.payloadResponse('relationships', relationships);
    } catch (error) {
        logger.error('Error creating bulk client-server relationships:', error);
        return JsonResponse.errorResponse(500, 'Failed to create client-server relationships');
    }
} 