import { NextRequest } from 'next/server';
import { getRegistryService } from '@/lib/services/registryService';
import { McpRegistryFilters } from '@/types/registry-api';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const search = searchParams.get('search') || undefined;
    const version = searchParams.get('version') || undefined;
    const updated_since = searchParams.get('updated_since') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    const filters: McpRegistryFilters = {
      search,
      version,
      updated_since,
      cursor,
      limit
    };

    const registryService = getRegistryService();
    const result = await registryService.searchServers(filters);

    logger.debug(`[server-registry API] Returned ${result.servers.length} filtered servers (out of ${result.metadata.count} total)`);

    return JsonResponse.payloadsResponse([
      { key: 'servers', payload: result.servers },
      { key: 'metadata', payload: result.metadata }
    ]);
  } catch (error) {
    logger.error('Error fetching server registry:', error);
    return JsonResponse.errorResponse(500, 'Failed to fetch server registry');
  }
}

export async function POST(request: NextRequest) {
  try {
    const registryService = getRegistryService();
    
    // Force reload the registry from the API
    await registryService.reloadRegistry();
    
    // Get the updated server count
    const servers = await registryService.getAllServers();
    
    logger.debug(`[server-registry API] Reloaded registry with ${servers.length} servers`);
    
    return JsonResponse.payloadsResponse([
      { key: 'message', payload: 'Registry reloaded successfully' },
      { key: 'serverCount', payload: servers.length },
      { key: 'registryFile', payload: registryService.getRegistryFilePath() }
    ]);
  } catch (error) {
    logger.error('Error reloading server registry:', error);
    return JsonResponse.errorResponse(500, 'Failed to reload server registry');
  }
}
