import { NextRequest } from 'next/server';
import { getServerCatalogService } from '@/lib/services/serverCatalogService';
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
      return JsonResponse.errorResponse(400, 'Server catalog ID is required');
    }

    const catalogService = getServerCatalogService();
    const server = await catalogService.getServerById(id);

    if (!server) {
      return JsonResponse.errorResponse(404, 'Server catalog entry not found');
    }

    logger.debug(`[server-catalog API] Retrieved server catalog entry: ${id}`);

    return JsonResponse.payloadResponse('server', server);
  } catch (error) {
    logger.error('Error fetching server catalog entry:', error);
    return JsonResponse.errorResponse(500, 'Failed to fetch server catalog entry');
  }
} 