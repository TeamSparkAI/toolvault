import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { ClientServerData } from '@/lib/models/types/clientServer';
import { ClientData } from '@/lib/models/types/client';
import { syncClient } from '@/lib/services/clientSyncService';
import { logger } from '@/lib/logging/server';

export type ClientServerRelationshipWithClient = ClientServerData & {
    client: ClientData | null;
};

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { serverId: string } }
) {
    try {
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();
        const clientModel = await ModelFactory.getInstance().getClientModel();

        const serverId = parseInt(params.serverId);
        if (isNaN(serverId)) {
            return JsonResponse.errorResponse(400, 'Invalid server ID');
        }

        // Get all client-server relationships for this server
        const clientServers = await clientServerModel.list({ serverId });

        // Get client details for each relationship
        const relationshipsWithClientDetails: ClientServerRelationshipWithClient[] = await Promise.all(
            clientServers.map(async (clientServer) => {
                const client = await clientModel.findById(clientServer.clientId);
                return {
                    ...clientServer,
                    client: client ? {
                        clientId: client.clientId,
                        token: client.token,
                        type: client.type,
                        scope: client.scope,
                        name: client.name,
                        description: client.description,
                        configPath: client.configPath,
                        autoUpdate: client.autoUpdate,
                        enabled: client.enabled,
                        lastUpdated: client.lastUpdated,
                        createdAt: client.createdAt,
                        updatedAt: client.updatedAt
                    } : null
                };
            })
        );

        return JsonResponse.payloadResponse('relationships', relationshipsWithClientDetails);
    } catch (error) {
        logger.error('Error getting server-client relationships:', error);
        return JsonResponse.errorResponse(500, 'Failed to get server-client relationships');
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { serverId: string } }
) {
    try {
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();
        const clientModel = await ModelFactory.getInstance().getClientModel();

        const serverId = parseInt(params.serverId);
        if (isNaN(serverId)) {
            return JsonResponse.errorResponse(400, 'Invalid server ID');
        }

        const body = await request.json();
        const clientIds = Array.isArray(body) ? body : [body];

        if (!clientIds.every(id => typeof id === 'number' && !isNaN(id))) {
            return JsonResponse.errorResponse(400, 'Invalid client IDs provided');
        }

        const relationships: ClientServerData[] = [];

        for (const clientId of clientIds) {
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

        const updatedRelationships: ClientServerData[] = [];

        // Iterate clients and sync if autoUpdate, get updated relationships
        for (const relationship of relationships) {
            const client = await clientModel.findById(relationship.clientId);
            if (client && client.autoUpdate) {
                await syncClient(client, { update: true, serverIds: [serverId] });
                const updatedRelationship = await clientServerModel.findById(relationship.clientServerId);
                if (updatedRelationship) {
                    updatedRelationships.push(updatedRelationship);
                }
            } else {
                updatedRelationships.push(relationship);
            }
        }

        return JsonResponse.payloadResponse('relationships', updatedRelationships);
    } catch (error) {
        logger.error('Error creating bulk server-client relationships:', error);
        return JsonResponse.errorResponse(500, 'Failed to create server-client relationships');
    }
} 