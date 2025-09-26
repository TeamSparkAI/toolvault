import { NextRequest } from 'next/server';
import { getRegistryService } from '@/lib/services/registryService';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return JsonResponse.errorResponse(400, 'Server ID is required');
    }

    const registryService = getRegistryService();
    const server = await registryService.getServerById(id);

    if (!server) {
      return JsonResponse.errorResponse(404, 'Server not found');
    }

    logger.debug(`[server-registry API] Retrieved server: ${id}`);

    return JsonResponse.payloadResponse('server', server);
  } catch (error) {
    logger.error('Error fetching server from registry:', error);
    return JsonResponse.errorResponse(500, 'Failed to fetch server from registry');
  }
}
