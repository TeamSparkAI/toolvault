import { NextRequest } from 'next/server';
import { JsonResponse } from '../../../../../lib/jsonResponse';
import { BridgeManager } from '../../../../../lib/bridge/BridgeManager';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const bridgeManager = BridgeManager.getInstance();
    const clients = await bridgeManager.getClientConfigs();
    
    return JsonResponse.payloadResponse('clients', clients);
  } catch (error) {
    logger.error('Error getting bridge clients:', error);
    return JsonResponse.errorResponse(500, 'Failed to get bridge clients');
  }
} 