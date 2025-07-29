import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';

type TimeUnit = 'hour' | 'day' | 'week' | 'month';
type Dimension = 'policyId' | 'filterName' | 'seen' | 'severity' | 'serverId' | 'clientId' | 'clientType';

interface AlertTimeSeriesParams {
    dimension: Dimension;
    timeUnit: TimeUnit;
    policyId?: number;
    filterName?: string;
    seen?: boolean;
    severity?: number;
    startTime?: string;
    endTime?: string;
    serverId?: number;
    clientId?: number;
    clientType?: string;
}

export interface AlertTimeSeriesData {
    timestamp: string;
    counts: Record<string, number>;
}

export interface AlertTimeSeriesPayload {
  data: Array<AlertTimeSeriesData>;
  query: {
    dimension: Dimension;
    timeUnit: TimeUnit;
    timeRange?: {
      start?: string;
      end?: string;
    };
    filters?: {
      policyId?: number;
      filterName?: string;
      seen?: boolean;
      severity?: number;
      serverId?: number;
      clientId?: number;
      clientType?: string;
    };
  };
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const params: AlertTimeSeriesParams = {
            dimension: searchParams.get('dimension') as Dimension,
            timeUnit: searchParams.get('timeUnit') as TimeUnit,
            policyId: searchParams.get('policyId') ? Number(searchParams.get('policyId')) : undefined,
            filterName: searchParams.get('filterName') || undefined,
            seen: searchParams.get('seen') === 'true' ? true : searchParams.get('seen') === 'false' ? false : undefined,
            severity: searchParams.get('severity') ? Number(searchParams.get('severity')) : undefined,
            startTime: searchParams.get('startTime') || undefined,
            endTime: searchParams.get('endTime') || undefined,
            serverId: searchParams.get('serverId') ? Number(searchParams.get('serverId')) : undefined,
            clientId: searchParams.get('clientId') ? Number(searchParams.get('clientId')) : undefined,
            clientType: searchParams.get('clientType') || undefined
        };

        if (!params.dimension || !params.timeUnit) {
            return JsonResponse.errorResponse(400, 'Missing required parameters');
        }

        const alertModel = await ModelFactory.getInstance().getAlertModel();
        const data = await alertModel.timeSeries(params);

        const response: AlertTimeSeriesPayload = {
            data,
            query: {
              dimension: params.dimension,
              timeUnit: params.timeUnit,
              timeRange: params.startTime || params.endTime ? {
                start: params.startTime,
                end: params.endTime
              } : undefined,
              filters: {
                ...(params.policyId && { policyId: params.policyId }),
                ...(params.filterName && { filterName: params.filterName }),
                ...(params.seen && { seen: params.seen }),
                ...(params.severity && { severity: params.severity }),
                ...(params.serverId && { serverId: params.serverId }),
                ...(params.clientId && { clientId: params.clientId }),
                ...(params.clientType && { clientType: params.clientType })
              }
            }
          };

        return JsonResponse.payloadResponse('timeSeries', response);
    } catch (error) {
        logger.error('Error in alerts timeSeries endpoint:', error);
        return JsonResponse.errorResponse(500, 'Internal server error');
    }
} 