import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { policyId: string } }
) {
    try {
        const policyModel = await ModelFactory.getInstance().getPolicyModel();
        const policy = await policyModel.findById(parseInt(params.policyId));
        if (!policy) {
            return JsonResponse.errorResponse(404, 'Policy not found');
        }
        return JsonResponse.payloadResponse('policy', policy);
    } catch (error) {
        logger.error('Error getting policy:', error);
        return JsonResponse.errorResponse(500, 'Failed to get policy');
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { policyId: string } }
) {
    try {
        const policyModel = await ModelFactory.getInstance().getPolicyModel();
        const data = await request.json();
        const policy = await policyModel.update(parseInt(params.policyId), data);
        return JsonResponse.payloadResponse('policy', policy);
    } catch (error) {
        logger.error('Error updating policy:', error);
        return JsonResponse.errorResponse(500, 'Failed to update policy');
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { policyId: string } }
) {
    try {
        const policyModel = await ModelFactory.getInstance().getPolicyModel();
        const deleted = await policyModel.delete(parseInt(params.policyId));
        
        if (!deleted) {
            return JsonResponse.errorResponse(404, 'Policy not found');
        }
        
        return JsonResponse.emptyResponse();
    } catch (error) {
        logger.error('Error deleting policy:', error);
        return JsonResponse.errorResponse(500, 'Failed to delete policy');
    }
} 