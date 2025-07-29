import { NextRequest } from 'next/server';
import { verifyProxyToken } from '@/lib/proxyJwt';
import { MessageFilterService } from '@/lib/services/messageFilter';
import { validateJsonRpcMessage, JsonRpcMessageWrapper } from '@/lib/jsonrpc';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { serverName: string } }
) {
  const { serverName } = params;

  try {
    // Get and validate JWT
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return JsonResponse.errorResponse(401, 'Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = verifyProxyToken(token);
    } catch (err) {
      return JsonResponse.errorResponse(401, 'Invalid token');
    }

    // Validate server name matches token
    if (payload.serverName !== serverName) {
      return JsonResponse.errorResponse(403, 'Token server name mismatch');
    }
    
    const messagePayload = await request.json();
    const { origin, sessionId, message } = messagePayload;

    if (!origin) {
      return JsonResponse.errorResponse(400, 'Missing origin');
    }
    if (origin !== 'client' && origin !== 'server') {
      return JsonResponse.errorResponse(400, 'Invalid origin');
    }

    const validatedMessage = validateJsonRpcMessage(origin, message);
    const result = await MessageFilterService.processMessage(payload, sessionId, validatedMessage);

    if (result.success) {
      return JsonResponse.payloadResponse('message', result.message);
    } else {
      return JsonResponse.errorResponse(400, result.error);
    }
  } catch (error) {
    logger.error('Error in message filtering:', error);
    return JsonResponse.errorResponse(500, 'Internal server error');
  }
} 