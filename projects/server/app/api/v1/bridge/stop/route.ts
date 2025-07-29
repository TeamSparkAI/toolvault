import { NextRequest } from 'next/server';
import { JsonResponse } from '../../../../../lib/jsonResponse';
import { BridgeManager } from '../../../../../lib/bridge/BridgeManager';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const bridgeManager = BridgeManager.getInstance();
    await bridgeManager.stop();
    
    return JsonResponse.payloadResponse('success', true);
  } catch (error) {
    logger.error('Error stopping bridge:', error);
    return JsonResponse.errorResponse(500, 'Failed to stop bridge');
  }
} 