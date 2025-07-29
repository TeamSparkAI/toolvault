import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const messageModel = await ModelFactory.getInstance().getMessageModel();
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const message = await messageModel.findById(parseInt(params.messageId));
    
    if (!message) {
      return JsonResponse.errorResponse(404, 'Message not found');
    }

    // Include server data if serverId is available
    let server = null;
    if (message.serverId) {
      server = await serverModel.findById(message.serverId);
    }

    return JsonResponse.payloadResponse('message', { ...message, server });
  } catch (error) {
    logger.error('Error in message endpoint:', error);
    return JsonResponse.errorResponse(500, 'Internal server error');
  }
} 