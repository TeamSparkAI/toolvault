import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const clientModel = await ModelFactory.getInstance().getClientModel();
    const client = await clientModel.findByToken(params.token);
    if (!client) {
      return JsonResponse.errorResponse(404, 'Client not found');
    }
    return JsonResponse.payloadResponse('client', client);
  } catch (error) {
    logger.error('Error finding client by token:', error);
    return JsonResponse.errorResponse(500, 'Failed to find client');
  }
} 