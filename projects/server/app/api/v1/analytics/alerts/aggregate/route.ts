import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';

type AlertDimension = 'policyId' | 'conditionName' | 'seen' | 'severity' | 'serverId' | 'clientId' | 'clientType';

export interface AlertAggregateParams {
    dimension: AlertDimension;
    policyId?: number;
    conditionName?: string;
    seen?: boolean;
    severity?: number;
    startTime?: string;
    endTime?: string;
    serverId?: number;
    clientId?: number;
    clientType?: string;
}

export interface AlertAggregateData {
    value: string;
    count: number;
}

export interface AlertAggregatePayload {
    data: Array<AlertAggregateData>;
    query: {
        dimension: string;
        timeRange?: {
            start?: string;
            end?: string;
        };
        filters?: {
            policyId?: number;
            conditionName?: string;
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
        const alertModel = await ModelFactory.getInstance().getAlertModel();
        const searchParams = request.nextUrl.searchParams;

        const dimension = searchParams.get('dimension') as AlertDimension;
        if (!dimension) {
            return JsonResponse.errorResponse(400, 'Dimension parameter is required');
        }

        const params: AlertAggregateParams = {
            dimension,
            policyId: searchParams.get('policyId') ? parseInt(searchParams.get('policyId')!) : undefined,
            conditionName: searchParams.get('conditionName') || undefined,
            seen: searchParams.get('seen') ? searchParams.get('seen') === 'true' : undefined,
            severity: searchParams.get('severity') ? parseInt(searchParams.get('severity')!) : undefined,
            startTime: searchParams.get('startTime') || undefined,
            endTime: searchParams.get('endTime') || undefined,
            serverId: searchParams.get('serverId') ? parseInt(searchParams.get('serverId')!) : undefined,
            clientId: searchParams.get('clientId') ? parseInt(searchParams.get('clientId')!) : undefined,
            clientType: searchParams.get('clientType') || undefined
        };

        const data = await alertModel.aggregate(params);

        const response: AlertAggregatePayload = {
            data,
            query: {
                dimension: params.dimension,
                timeRange: params.startTime || params.endTime ? {
                    start: params.startTime,
                    end: params.endTime
                } : undefined,
                filters: {
                    ...(params.policyId && { policyId: params.policyId }),
                    ...(params.conditionName && { conditionName: params.conditionName }),
                    ...(params.seen !== undefined && { seen: params.seen }),
                    ...(params.severity !== undefined && { severity: params.severity }),
                    ...(params.serverId && { serverId: params.serverId }),
                    ...(params.clientId && { clientId: params.clientId }),
                    ...(params.clientType && { clientType: params.clientType })
                }
            }
        };

        return JsonResponse.payloadResponse<AlertAggregatePayload>('aggregate', response);
    } catch (error) {
        logger.error('Error getting alert aggregates:', error);
        return JsonResponse.errorResponse(500, 'Failed to get alert aggregates');
    }
} 