import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const messageModel = await ModelFactory.getInstance().getMessageModel();
        const url = new URL(request.url);
        const sort = (url.searchParams.get('sort') || 'desc') as 'asc' | 'desc';
        const limit = 20;
        const cursor = url.searchParams.get('cursor') ? parseInt(url.searchParams.get('cursor')!) : undefined;

        // Build filter object from query parameters
        const filter = {
            serverName: url.searchParams.get('serverName') || undefined,
            serverId: url.searchParams.get('serverId') ? Number(url.searchParams.get('serverId')) : undefined,
            payloadMethod: url.searchParams.get('payloadMethod') || undefined,
            payloadToolName: url.searchParams.get('payloadToolName') || undefined,
            userId: url.searchParams.get('userId') || undefined,
            clientId: url.searchParams.get('clientId') ? Number(url.searchParams.get('clientId')) : undefined,
            clientType: url.searchParams.get('clientType') || undefined,
            sourceIP: url.searchParams.get('sourceIP') || undefined,
            sessionId: url.searchParams.get('sessionId') || undefined
        };

        const result = await messageModel.list(filter, { sort, limit, cursor });

        return JsonResponse.payloadsResponse([
            { 
                key: 'messages', 
                payload: result.messages
            },
            {
                key: 'pagination',
                payload: result.pagination
            }
        ]);
    } catch (error) {
        logger.error('Error in messages endpoint:', error);
        return JsonResponse.errorResponse(500, 'Internal server error');
    }
}
