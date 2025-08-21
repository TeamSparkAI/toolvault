import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
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

    // Get server data to get the config
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const serverData = await serverModel.findById(serverId);
    if (!serverData) {
      return JsonResponse.errorResponse(404, 'Server not found');
    }

    logger.info(`Security validation request for server ${serverId} with version: ${version || 'latest'}`);
    
    const result = await SecurityValidationService.validateServerUpdate(serverData.config, version || 'latest');
    
    return JsonResponse.payloadResponse('validation', result);
  } catch (error) {
    logger.error('Security validation failed:', error);
    return JsonResponse.errorResponse(500, 'Security validation failed');
  }
}
