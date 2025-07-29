import { NextRequest, NextResponse } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { syncClient, SyncOptions } from '@/lib/services/clientSyncService';
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
        return JsonResponse.payloadResponse('sync', response);
    } catch (error) {
        logger.error('Error in client sync:', error);
        return JsonResponse.errorResponse(500, 'Internal server error');
    }
}