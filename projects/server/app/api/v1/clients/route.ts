import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const clientModel = await ModelFactory.getInstance().getClientModel();
        const clients = await clientModel.list();
        return JsonResponse.payloadResponse('clients', clients);
    } catch (error) {
        logger.error('Error listing clients:', error);
        return JsonResponse.errorResponse(500, 'Failed to list clients');
    }
}

export async function POST(request: Request) {
    try {
        const clientModel = await ModelFactory.getInstance().getClientModel();
        const data = await request.json();
        // Ensure scope is present
        if (!data.scope) {
            data.scope = 'project';
        }
        const client = await clientModel.create(data);
        return JsonResponse.payloadResponse('client', client);
    } catch (error) {
        logger.error('Error creating client:', error);
        return JsonResponse.errorResponse(500, 'Failed to create client');
    }
} 