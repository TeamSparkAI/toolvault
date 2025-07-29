import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';

type MessageDimension = 'serverName' | 'userId' | 'clientId' | 'method' | 'sourceIP' | 'clientType' | 'toolName';

export interface MessageAggregateParams {
  dimension: MessageDimension;
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

export interface MessageAggregateData {
    value: string;
    count: number;
}

export interface MessageAggregatePayload {
  data: Array<MessageAggregateData>;
  query: {
    dimension: string;
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

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const messageModel = await ModelFactory.getInstance().getMessageModel();
    const url = new URL(request.url);

    const dimension = url.searchParams.get('dimension') as MessageDimension;
    if (!dimension) {
      return JsonResponse.errorResponse(400, 'Dimension parameter is required');
    }

    const params: MessageAggregateParams = {
      dimension,
      serverName: url.searchParams.get('serverName') || undefined,
      serverId: url.searchParams.get('serverId') ? Number(url.searchParams.get('serverId')) : undefined,
      userId: url.searchParams.get('userId') || undefined,
      clientId: url.searchParams.get('clientId') ? Number(url.searchParams.get('clientId')) : undefined,
      clientType: url.searchParams.get('clientType') || undefined,
      payloadMethod: url.searchParams.get('payloadMethod') || undefined,
      payloadToolName: url.searchParams.get('payloadToolName') || undefined,
      sourceIP: url.searchParams.get('sourceIP') || undefined,
      startTime: url.searchParams.get('startTime') || undefined,
      endTime: url.searchParams.get('endTime') || undefined
    };

    const data = await messageModel.aggregate(params);

    const response: MessageAggregatePayload = {
      data,
      query: {
        dimension: params.dimension,
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

    return JsonResponse.payloadResponse<MessageAggregatePayload>('aggregate', response);
  } catch (error) {
    logger.error('Error in aggregate endpoint:', error);
    return JsonResponse.errorResponse(500, 'An error occurred');
  }
} 