import { NextRequest } from 'next/server';
import { getServerCatalogService } from '@/lib/services/serverCatalogService';
import { ServerCatalogFilters } from '@/types/server-catalog';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const tags = searchParams.get('tags')?.split(',') || undefined;
    const transport = searchParams.get('transport') as 'stdio' | 'sse' | undefined;

    const filters: ServerCatalogFilters = {
      search,
      tags,
      transport
    };

    const catalogService = getServerCatalogService();
    const result = await catalogService.searchServers(filters);

    logger.debug(`[server-catalog API] Returned ${result.servers.length} filtered servers (out of ${result.total} total)`);

    return JsonResponse.payloadResponse('servers', result.servers);
  } catch (error) {
    logger.error('Error fetching server catalog:', error);
    return JsonResponse.errorResponse(500, 'Failed to fetch server catalog');
  }
} 