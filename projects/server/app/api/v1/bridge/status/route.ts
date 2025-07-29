import { NextRequest } from 'next/server';
import { JsonResponse } from '../../../../../lib/jsonResponse';
import { BridgeManager } from '../../../../../lib/bridge/BridgeManager';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const bridgeManager = BridgeManager.getInstance();
    const status = await bridgeManager.getStatus();
    
    return JsonResponse.payloadResponse('status', status);
  } catch (error) {
    logger.error('Error getting bridge status:', error);
    return JsonResponse.errorResponse(500, 'Failed to get bridge status');
  }
} 