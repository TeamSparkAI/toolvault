import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const clientModel = await ModelFactory.getInstance().getClientModel();
    const client = await clientModel.findById(parseInt(params.clientId));
    if (!client) {
      return JsonResponse.errorResponse(404, 'Client not found');
    }
    return JsonResponse.payloadResponse('client', client);
  } catch (error) {
    logger.error('Error getting client:', error);
    return JsonResponse.errorResponse(500, 'Failed to get client');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const clientModel = await ModelFactory.getInstance().getClientModel();
    const data = await request.json();
    const client = await clientModel.update(parseInt(params.clientId), data);
    return JsonResponse.payloadResponse('client', client);
  } catch (error) {
    logger.error('Error updating client:', error);
    return JsonResponse.errorResponse(500, 'Failed to update client');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const clientModel = await ModelFactory.getInstance().getClientModel();
    const deleted = await clientModel.delete(parseInt(params.clientId));
    
    if (!deleted) {
      return JsonResponse.errorResponse(404, 'Client not found');
    }
    
    return JsonResponse.emptyResponse();
  } catch (error) {
    logger.error('Error deleting client:', error);
    return JsonResponse.errorResponse(500, 'Failed to delete client');
  }
} 