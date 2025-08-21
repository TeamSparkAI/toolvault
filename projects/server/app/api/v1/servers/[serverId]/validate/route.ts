import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { SecurityValidationService } from '@/lib/services/securityValidationService';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    const serverId = parseInt(params.serverId);
    if (isNaN(serverId)) {
      return JsonResponse.errorResponse(400, 'Invalid server ID');
    }

    // Get version from query params
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version');

    logger.info(`Security validation request for server ${serverId} with version: ${version || 'latest'}`);
    
    const result = await SecurityValidationService.validateServerUpdate(serverId, version || undefined);
    
    return JsonResponse.payloadResponse('validation', result);
  } catch (error) {
    logger.error('Security validation failed:', error);
    return JsonResponse.errorResponse(500, 'Security validation failed');
  }
}
