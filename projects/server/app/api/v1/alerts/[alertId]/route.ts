import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { alertId: string } }
) {
    try {
        const alertId = parseInt(params.alertId);
        if (isNaN(alertId)) {
            return JsonResponse.errorResponse(400, 'Invalid alert ID');
        }

        const alertModel = await ModelFactory.getInstance().getAlertModel();
        const alert = await alertModel.findById(alertId);

        if (!alert) {
            return JsonResponse.errorResponse(404, 'Alert not found');
        }

        return JsonResponse.payloadResponse('alert', alert);
    } catch (error) {
        logger.error('Error in alert detail endpoint:', error);
        return JsonResponse.errorResponse(500, 'Internal server error');
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { alertId: string } }
) {
    try {
        const alertId = parseInt(params.alertId);
        if (isNaN(alertId)) {
            return JsonResponse.errorResponse(400, 'Invalid alert ID');
        }

        const body = await request.json();
        if (typeof body.seen !== 'boolean') {
            return JsonResponse.errorResponse(400, 'Missing or invalid seen status');
        }

        const alertModel = await ModelFactory.getInstance().getAlertModel();
        const alert = await alertModel.findById(alertId);

        if (!alert) {
            return JsonResponse.errorResponse(404, 'Alert not found');
        }

        // If marking as seen and already seen, or marking as unseen and already unseen, return current state
        if ((body.seen && alert.seenAt) || (!body.seen && !alert.seenAt)) {
            return JsonResponse.payloadResponse('alert', alert);
        }

        // Update the alert's seen status
        const updatedAlert = body.seen 
            ? await alertModel.markAsSeen(alertId)
            : await alertModel.markAsUnseen(alertId);

        return JsonResponse.payloadResponse('alert', updatedAlert);
    } catch (error) {
        logger.error('Error updating alert:', error);
        return JsonResponse.errorResponse(500, 'Internal server error');
    }
} 