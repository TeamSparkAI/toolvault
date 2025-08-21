import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { PackageExtractionService } from '@/lib/services/packageExtractionService';
import { packageInfoService } from '@/lib/services/packageInfoService';
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

    logger.info(`Package info request for server ${serverId}`);

    // Get server data
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const serverData = await serverModel.findById(serverId);
    if (!serverData) {
      return JsonResponse.errorResponse(404, 'Server not found');
    }

    // Analyze server config to get package info
    const analysis = PackageExtractionService.analyzeServerConfig(serverData.config);
    if (!analysis.packageInfo) {
      return JsonResponse.errorResponse(400, 'Server configuration does not contain package information');
    }

    const { packageInfo } = analysis;

    // Get package info for the latest version (all versions will be included)
    const packageInfoResult = await packageInfoService.getPackageInfoForVersion(
      packageInfo.registry,
      packageInfo.packageName
    );

    return JsonResponse.payloadResponse('package', packageInfoResult);
  } catch (error) {
    logger.error('Package info request failed:', error);
    return JsonResponse.errorResponse(500, 'Failed to get package information');
  }
}
