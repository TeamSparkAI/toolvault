import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { ClientServerData } from '@/lib/models/types/clientServer';
import { syncClient } from '@/lib/services/clientSyncService';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { clientId: string; serverId: string } }
) {
    try {
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();

        const clientId = parseInt(params.clientId);
        const serverId = parseInt(params.serverId);

        if (isNaN(clientId) || isNaN(serverId)) {
            return JsonResponse.errorResponse(400, 'Invalid client ID or server ID');
        }

        const relationship = await clientServerModel.findByClientAndServer(clientId, serverId);

        if (!relationship) {
            return JsonResponse.errorResponse(404, 'Client-server relationship not found');
        }

        return JsonResponse.payloadResponse('relationship', relationship);
    } catch (error) {
        logger.error('Error getting client-server relationship:', error);
        return JsonResponse.errorResponse(500, 'Failed to get client-server relationship');
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { clientId: string; serverId: string } }
) {
    try {
        const clientModel = await ModelFactory.getInstance().getClientModel();
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();

        const clientId = parseInt(params.clientId);
        const serverId = parseInt(params.serverId);

        if (isNaN(clientId) || isNaN(serverId)) {
            return JsonResponse.errorResponse(400, 'Invalid client ID or server ID');
        }

        const client = await clientModel.findById(clientId);
        if (!client) {
            return JsonResponse.errorResponse(404, 'Client not found');
        }

        const { clientServerName, toolNames } = await request.json();

        // Check if relationship exists
        const existingRelationship = await clientServerModel.findByClientAndServer(clientId, serverId);
        let updatedRelationship: ClientServerData | null = null;

        if (existingRelationship) {
            // Update existing relationship
            if (existingRelationship.syncState === "deleteScanned") {
                existingRelationship.syncState = "scanned"; // Undo the delete
            } else if (existingRelationship.syncState === "deletePushed") {
                existingRelationship.syncState = "pushed"; // Undo the delete
            }

            // Only update fields if they are explicitly provided in the request body
            if (clientServerName !== undefined) {
                existingRelationship.clientServerName = clientServerName;
            }
            if (toolNames !== undefined) {
                existingRelationship.toolNames = toolNames;
            }

            updatedRelationship = await clientServerModel.update(existingRelationship.clientServerId, existingRelationship);
        } else {
            // Create new relationship
            updatedRelationship = await clientServerModel.create({
                clientId,
                serverId,
                clientServerName,
                toolNames,
                syncState: "add"
            });
        }

        if (client.autoUpdate) {
            await syncClient(client, { update: true, serverIds: [serverId] });
            // We re-get the relationship after sync to get the updated syncState
            updatedRelationship = await clientServerModel.findById(updatedRelationship.clientServerId);
        }
        return JsonResponse.payloadResponse('relationship', updatedRelationship);
    } catch (error) {
        logger.error('Error creating/updating client-server relationship:', error);
        return JsonResponse.errorResponse(500, 'Failed to create/update client-server relationship');
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { clientId: string; serverId: string } }
) {
    try {
        const clientModel = await ModelFactory.getInstance().getClientModel();
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();

        const clientId = parseInt(params.clientId);
        const serverId = parseInt(params.serverId);

        if (isNaN(clientId) || isNaN(serverId)) {
            return JsonResponse.errorResponse(400, 'Invalid client ID or server ID');
        }

        const client = await clientModel.findById(clientId);
        if (!client) {
            return JsonResponse.errorResponse(404, 'Client not found');
        }

        const relationship = await clientServerModel.findByClientAndServer(clientId, serverId);

        if (!relationship) {
            return JsonResponse.errorResponse(404, 'Client-server relationship not found');
        }

        if (relationship.syncState === "add") {
            // If the relationship is an "add", we need to delete the relation ("undo" of the add)
            const deleted = await clientServerModel.delete(relationship.clientServerId);
            if (!deleted) {
                return JsonResponse.errorResponse(404, 'Client-server relationship not found');
            }
        } else {
            if (relationship.syncState === "scanned") {
                relationship.syncState = "deleteScanned";
            } else if (relationship.syncState === "pushed") {
                relationship.syncState = "deletePushed";
            } else {
                // Error: Can only DELETE a pending add, or a scanned/pushed relation
            }
            await clientServerModel.update(relationship.clientServerId, relationship);

            if (client.autoUpdate) {
                await syncClient(client, { update: true, serverIds: [serverId] });
            }
        }

        return JsonResponse.emptyResponse();
    } catch (error) {
        logger.error('Error deleting client-server relationship:', error);
        return JsonResponse.errorResponse(500, 'Failed to delete client-server relationship');
    }
} 