import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';

export async function POST(request: NextRequest) {
    try {
        const payload = await request.json();
        logger.debug('mark-all API received payload:', payload);
        const { seen, ...filter } = payload;
        logger.debug('mark-all API extracted seen:', seen, 'filter:', filter);

        if (typeof seen !== 'boolean') {
            logger.debug('mark-all API error: seen is not boolean, type:', typeof seen, 'value:', seen);
            return JsonResponse.errorResponse(400, 'Missing or invalid seen status');
        }

        const alertModel = await ModelFactory.getInstance().getAlertModel();
        await alertModel.markAll({ ...filter, seen });

        return JsonResponse.payloadsResponse([
            {
                key: 'success',
                payload: true
            }
        ]);
    } catch (error) {
        logger.error('Error marking alerts:', error);
        return JsonResponse.errorResponse(500, 'Failed to mark alerts');
    }
} 