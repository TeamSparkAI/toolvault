import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';

export const dynamic = 'force-dynamic';

type Dimension = 'serverName' | 'method' | 'userId' | 'clientId' | 'sourceIP' | 'sessionId' | 'clientType' | 'toolName';
type TimeUnit = 'hour' | 'day' | 'week' | 'month';

export interface MessageTimeSeriesParams {
  dimension: Dimension;
  timeUnit: TimeUnit;
  serverName?: string;
  serverId?: number;
  userId?: string;
  clientId?: number;
  clientType?: string;
  payloadMethod?: string;
  payloadToolName?: string;
  sourceIP?: string;
  startTime?: string;
  endTime?: string;
}

export interface MessageTimeSeriesData {
    timestamp: string;
    counts: Record<string, number>;
}

export interface MessageTimeSeriesPayload {
  data: Array<MessageTimeSeriesData>;
  query: {
    dimension: Dimension;
    timeUnit: TimeUnit;
    timeRange?: {
      start?: string;
      end?: string;
    };
    filters?: {
      serverName?: string;
      serverId?: number;
      userId?: string;
      clientId?: number;
      clientType?: string;
      payloadMethod?: string;
      payloadToolName?: string;
      sourceIP?: string;
    };
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params: MessageTimeSeriesParams = {
      dimension: searchParams.get('dimension') as Dimension,
      timeUnit: searchParams.get('timeUnit') as TimeUnit,
      serverName: searchParams.get('serverName') || undefined,
      serverId: searchParams.get('serverId') ? Number(searchParams.get('serverId')) : undefined,
      userId: searchParams.get('userId') || undefined,
      clientId: searchParams.get('clientId') ? Number(searchParams.get('clientId')) : undefined,
      clientType: searchParams.get('clientType') || undefined,
      payloadMethod: searchParams.get('payloadMethod') || undefined,
      payloadToolName: searchParams.get('payloadToolName') || undefined,
      sourceIP: searchParams.get('sourceIP') || undefined,
      startTime: searchParams.get('startTime') || undefined,
      endTime: searchParams.get('endTime') || undefined,
    };

    if (!params.dimension || !params.timeUnit) {
      return JsonResponse.errorResponse(400, 'Missing required parameters');
    }

    const messageModel = await ModelFactory.getInstance().getMessageModel();
    const data = await messageModel.timeSeries(params);

    const response: MessageTimeSeriesPayload = {
      data,
      query: {
        dimension: params.dimension,
        timeUnit: params.timeUnit,
        timeRange: params.startTime || params.endTime ? {
          start: params.startTime,
          end: params.endTime
        } : undefined,
        filters: {
          ...(params.serverName && { serverName: params.serverName }),
          ...(params.serverId && { serverId: params.serverId }),
          ...(params.userId && { userId: params.userId }),
          ...(params.clientId && { clientId: params.clientId }),
          ...(params.clientType && { clientType: params.clientType }),
          ...(params.payloadMethod && { payloadMethod: params.payloadMethod }),
          ...(params.payloadToolName && { payloadToolName: params.payloadToolName }),
          ...(params.sourceIP && { sourceIP: params.sourceIP })
        }
      }
    };

    return JsonResponse.payloadResponse<MessageTimeSeriesPayload>('timeSeries', response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return JsonResponse.errorResponse(500, errorMessage);
  }
} 