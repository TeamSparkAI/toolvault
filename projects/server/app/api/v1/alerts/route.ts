import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const alertModel = await ModelFactory.getInstance().getAlertModel();
        const url = new URL(request.url);
        const sort = (url.searchParams.get('sort') || 'desc') as 'asc' | 'desc';
        const limit = 20;
        const cursor = url.searchParams.get('cursor') ? parseInt(url.searchParams.get('cursor')!) : undefined;

        // Build filter object from query parameters
        const filter = {
            messageId: url.searchParams.get('messageId') ? Number(url.searchParams.get('messageId')) : undefined,
            policyId: url.searchParams.get('policyId') ? Number(url.searchParams.get('policyId')) : undefined,
            filterName: url.searchParams.get('filterName') || undefined,
            seen: url.searchParams.get('seen') === 'true' ? true : url.searchParams.get('seen') === 'false' ? false : undefined,
            severity: url.searchParams.get('severity') ? Number(url.searchParams.get('severity')) : undefined,
            startTime: url.searchParams.get('startTime') || undefined,
            endTime: url.searchParams.get('endTime') || undefined,
            serverId: url.searchParams.get('serverId') ? Number(url.searchParams.get('serverId')) : undefined,
            clientId: url.searchParams.get('clientId') ? Number(url.searchParams.get('clientId')) : undefined,
            clientType: url.searchParams.get('clientType') || undefined
        };

        const result = await alertModel.list(filter, { sort, limit, cursor });

        return JsonResponse.payloadsResponse([
            { 
                key: 'alerts', 
                payload: result.alerts
            },
            {
                key: 'pagination',
                payload: result.pagination
            }
        ]);
    } catch (error) {
        logger.error('Error in alerts endpoint:', error);
        return JsonResponse.errorResponse(500, 'Internal server error');
    }
} 