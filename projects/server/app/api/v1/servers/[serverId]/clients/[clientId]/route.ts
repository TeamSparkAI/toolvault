import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { syncClient } from '@/lib/services/clientSyncService';
import { ClientServerData } from '@/lib/models/types/clientServer';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { serverId: string; clientId: string } }
) {
    try {
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();

        const serverId = parseInt(params.serverId);
        const clientId = parseInt(params.clientId);

        if (isNaN(serverId) || isNaN(clientId)) {
            return JsonResponse.errorResponse(400, 'Invalid server ID or client ID');
        }

        const relationship = await clientServerModel.findByClientAndServer(clientId, serverId);

        if (!relationship) {
            return JsonResponse.errorResponse(404, 'Server-client relationship not found');
        }

        return JsonResponse.payloadResponse('relationship', relationship);
    } catch (error) {
        logger.error('Error getting server-client relationship:', error);
        return JsonResponse.errorResponse(500, 'Failed to get server-client relationship');
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { serverId: string; clientId: string } }
) {
    try {
        const clientModel = await ModelFactory.getInstance().getClientModel();
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();

        const serverId = parseInt(params.serverId);
        const clientId = parseInt(params.clientId);

        if (isNaN(serverId) || isNaN(clientId)) {
            return JsonResponse.errorResponse(400, 'Invalid server ID or client ID');
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

            updatedRelationship = await clientServerModel.update(existingRelationship.clientServerId, existingRelationship);            return JsonResponse.payloadResponse('relationship', updatedRelationship);
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
        logger.error('Error creating/updating server-client relationship:', error);
        return JsonResponse.errorResponse(500, 'Failed to create/update server-client relationship');
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { serverId: string; clientId: string } }
) {
    try {
        const clientModel = await ModelFactory.getInstance().getClientModel();
        const clientServerModel = await ModelFactory.getInstance().getClientServerModel();

        const serverId = parseInt(params.serverId);
        const clientId = parseInt(params.clientId);

        if (isNaN(serverId) || isNaN(clientId)) {
            return JsonResponse.errorResponse(400, 'Invalid server ID or client ID');
        }

        const client = await clientModel.findById(clientId);
        if (!client) {
            return JsonResponse.errorResponse(404, 'Client not found');
        }

        const relationship = await clientServerModel.findByClientAndServer(clientId, serverId);

        if (!relationship) {
            return JsonResponse.errorResponse(404, 'Server-client relationship not found');
        }

        if (relationship.syncState === "add") {
            // If the relationship is an "add", we need to delete the relation ("undo" of the add)
            const deleted = await clientServerModel.delete(relationship.clientServerId);
            if (!deleted) {
                return JsonResponse.errorResponse(404, 'Server-client relationship not found');
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
        logger.error('Error deleting server-client relationship:', error);
        return JsonResponse.errorResponse(500, 'Failed to delete server-client relationship');
    }
} 