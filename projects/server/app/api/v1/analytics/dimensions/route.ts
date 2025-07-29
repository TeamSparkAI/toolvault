import { NextRequest } from 'next/server';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

// Dimensions
//
// Filter name   | Domain | key            | Type   | label
// ============= | ====== | ============== | ====== | ==================
// Server        | Msg    | serverId       | Lookup | serverName
// Client        | Msg    | clientId       | Lookup | clientName
// Client Type   | Msg    | clientType     | Static | Map to static client type strings (and values)
// Method        | Msg    | payloadMethod  | ID     | method (from db), or use static list?
// Tool Name     | Msg    | paylodToolName | ID     | toolName (from db)
// User ID       | Msg    | userId         | ID     | userId (from db)
// Source IP     | Msg    | sourceIp       | ID     | sourceIp (from db)
// Session ID    | Msg    | sessionId      | ID     | sessionId (from db)
// Policy        | Alert  | policyId       | Lookup | policyName
// Severity      | Alert  | severity       | Static | Map to static severity strings (and values)
// Seen          | Alert  | seen           | Static | Map to static seen type strings and values (seen/unseen)
// Filter        | Alert  | filterName     | ID     | filterName
//
// Message are filterable by Msg domain filters
// Alerts are filterable by all Msg and Alert domain filters
//
// For IDs that are mapped, you can choose to use either the value or the label from the returned dimension(s)
//
// Dimension context: 
// !!! There is an issue about how to handle filtering on Msg dimensions when they could be in the context of Alert filters (We're filtering
//     on Alerts and only want to see the Msg dimensions that are relevant to the messages corresponding to the filtered alerts).  If we have
//     any Alert filters, we could infer that we want filter the messages that correspond to the alerts passing the filter, and if there are
//     no alert filters, then we're not filterin on alerts so the message filters appled to all messages would work fine.
//

const MESSAGE_DIMENSIONS = ['serverId', 'serverName', 'userId', 'clientId', 'clientType', 'payloadMethod', 'payloadToolName', 'sourceIP', 'sessionId'] as const;
type MessageDimension = typeof MESSAGE_DIMENSIONS[number];

const ALERT_DIMENSIONS = ['policyId', 'filterName', 'seen', 'severity'] as const;
type AlertDimension = typeof ALERT_DIMENSIONS[number];

export type Dimension = MessageDimension | AlertDimension;

// Define which dimensions need ID->name mapping
const ID_DIMENSIONS: Partial<Record<MessageDimension | AlertDimension, {
  model: 'server' | 'policy' | 'client';
  idField: string;
  nameField: string;
}>> = {
  serverId: {
    model: 'server',
    idField: 'serverId',
    nameField: 'name'
  },
  policyId: {
    model: 'policy',
    idField: 'policyId',
    nameField: 'name'
  },
  clientId: {
    model: 'client',
    idField: 'clientId',
    nameField: 'name'
  }
} as const;

// Define static dimensions with their values
const STATIC_DIMENSIONS = {
  severity: [
    { value: '1', label: 'Critical' },
    { value: '2', label: 'High' },
    { value: '3', label: 'Medium' },
    { value: '4', label: 'Low' },
    { value: '5', label: 'Info' }
  ],
  seen: [
    { value: 'seen', label: 'Seen' },
    { value: 'unseen', label: 'New' }
  ],
  clientType: [
    { value: 'cursor', label: 'Cursor' },
    { value: 'roocode', label: 'Roo Code' },
    { value: 'windsurf', label: 'Windsurf' },
    { value: 'claudecode', label: 'Claude Code' },
    { value: 'vscode', label: 'VS Code' },
    { value: 'ttv', label: 'Tool Vault' },
    { value: 'generic', label: 'Generic' }
  ]
} as const;

export interface DimensionsParams {
  dimensions: Dimension[];
  // Message filters
  serverName?: string;
  serverId?: number;
  userId?: string;
  clientId?: number;
  clientType?: string;
  payloadMethod?: string;
  payloadToolName?: string;
  sourceIP?: string;
  // Alert filters
  policyId?: number;
  filterName?: string;
  seen?: boolean;
  severity?: number;
  // Common filters
  startTime?: string;
  endTime?: string;
}

export interface DimensionsPayload {
  data: Record<string, Array<{
    value: string;
    label: string;
  }>>;
  query: {
    dimensions: string[];
    timeRange?: {
      start?: string;
      end?: string;
    };
    filters?: {
      // Message filters
      serverName?: string;
      serverId?: number;
      userId?: string;
      clientId?: number;
      clientType?: string;
      payloadMethod?: string;
      payloadToolName?: string;
      sourceIP?: string;
      // Alert filters
      policyId?: number;
      filterName?: string;
      seen?: boolean;
      severity?: number;
    };
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const dimensions = searchParams.getAll('dimension') as Dimension[];
    if (dimensions.length === 0) {
      return JsonResponse.errorResponse(400, 'Dimensions parameter is required');
    }

    const params: DimensionsParams = {
      dimensions,
      // Message filters
      serverName: searchParams.get('serverName') || undefined,
      serverId: searchParams.get('serverId') ? Number(searchParams.get('serverId')) : undefined,
      userId: searchParams.get('userId') || undefined,
      clientId: searchParams.get('clientId') ? Number(searchParams.get('clientId')) : undefined,
      clientType: searchParams.get('clientType') || undefined,
      payloadMethod: searchParams.get('payloadMethod') || undefined,
      payloadToolName: searchParams.get('payloadToolName') || undefined,
      sourceIP: searchParams.get('sourceIP') || undefined,
      // Alert filters
      policyId: searchParams.get('policyId') ? Number(searchParams.get('policyId')) : undefined,
      filterName: searchParams.get('filterName') || undefined,
      seen: searchParams.get('seen') ? searchParams.get('seen') === 'true' : undefined,
      severity: searchParams.get('severity') ? Number(searchParams.get('severity')) : undefined,
      // Common filters
      startTime: searchParams.get('startTime') || undefined,
      endTime: searchParams.get('endTime') || undefined
    };

    // Get models
    const messageModel = await ModelFactory.getInstance().getMessageModel();
    const alertModel = await ModelFactory.getInstance().getAlertModel();
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const policyModel = await ModelFactory.getInstance().getPolicyModel();
    const clientModel = await ModelFactory.getInstance().getClientModel();

    // Split dimensions into different types
    const idDimensions = dimensions.filter(dim => dim in ID_DIMENSIONS);
    const staticDimensions = dimensions.filter(dim => dim in STATIC_DIMENSIONS);
    const dynamicDimensions = dimensions.filter(dim => !idDimensions.includes(dim) && !staticDimensions.includes(dim));

    // Split dynamic dimensions into message and alert dimensions
    const messageDimensions = dynamicDimensions.filter(dim => MESSAGE_DIMENSIONS.includes(dim as MessageDimension));
    const alertDimensions = dynamicDimensions.filter(dim => ALERT_DIMENSIONS.includes(dim as AlertDimension));

    // Fetch all dimension values in parallel
    const [
      messageData,
      alertData,
      idData
    ] = await Promise.all([
      messageDimensions.length > 0 ? messageModel.getDimensionValues({
        dimensions: messageDimensions,
        serverName: params.serverName,
        serverId: params.serverId,
        userId: params.userId,
        clientId: params.clientId,
        clientType: params.clientType,
        payloadMethod: params.payloadMethod,
        payloadToolName: params.payloadToolName,
        sourceIP: params.sourceIP,
        startTime: params.startTime,
        endTime: params.endTime
      }) : Promise.resolve({}),
      alertDimensions.length > 0 ? alertModel.getDimensionValues({
        dimensions: alertDimensions,
        policyId: params.policyId,
        filterName: params.filterName,
        seen: params.seen,
        startTime: params.startTime,
        endTime: params.endTime,
        serverId: params.serverId,
        clientId: params.clientId,
        clientType: params.clientType
      }) : Promise.resolve({}),
      // Handle ID-based dimensions
      Promise.all(idDimensions.map(async dim => {
        const config = ID_DIMENSIONS[dim];
        if (!config) {
          throw new Error(`No configuration found for dimension: ${dim}`);
        }

        let model;
        switch (config.model) {
          case 'server':
            model = serverModel;
            break;
          case 'policy':
            model = policyModel;
            break;
          case 'client':
            model = clientModel;
            break;
          default:
            throw new Error(`Unknown model type: ${config.model}`);
        }

        // Get the IDs from messages/alerts first
        const idValues = MESSAGE_DIMENSIONS.includes(dim as MessageDimension)
          ? await messageModel.getDimensionValues({ 
              dimensions: [dim], 
              serverName: params.serverName,
              serverId: params.serverId,
              userId: params.userId,
              clientId: params.clientId,
              clientType: params.clientType,
              payloadMethod: params.payloadMethod,
              payloadToolName: params.payloadToolName,
              sourceIP: params.sourceIP,
              startTime: params.startTime,
              endTime: params.endTime
            })
          : await alertModel.getDimensionValues({ 
              dimensions: [dim],
              policyId: params.policyId,
              filterName: params.filterName,
              seen: params.seen,
              startTime: params.startTime,
              endTime: params.endTime,
              serverId: params.serverId,
              clientId: params.clientId,
              clientType: params.clientType
            });

        // Get the names for these IDs
        const ids = idValues[dim] || [];
        const numericIds = ids.map(id => Number(id));
        const records = await model.getByIds(numericIds);
        
        return {
          [dim]: records.map((record) => ({
            value: String(record[config.idField as keyof typeof record]),
            label: record.name // nameField is "name" for all current cases
          }))
        };
      })).then(results => Object.assign({}, ...results))
    ]);

    // Combine all results
    const result = {
      data: {
        // Static dimensions already have value/label pairs
        ...Object.fromEntries(
          staticDimensions.map(dim => [
            dim,
            STATIC_DIMENSIONS[dim as keyof typeof STATIC_DIMENSIONS]
          ])
        ),
        // ID-based dimensions get labels from lookup
        ...idData,
        // Everything else uses the value as both value and label
        ...(Object.keys(messageData).length > 0 ? Object.fromEntries(
          Object.entries(messageData).map(([dim, values]) => [
            dim,
            (dim === 'payloadToolName'
              ? (values as string[]).filter(v => v !== '')
              : (values as string[])
            ).map(value => ({
              value: String(value),
              label: String(value)
            }))
          ])
        ) : {}),
        ...(Object.keys(alertData).length > 0 ? Object.fromEntries(
          Object.entries(alertData).map(([dim, values]) => [
            dim,
            (values as string[]).map(value => ({
              value: String(value),
              label: String(value)
            }))
          ])
        ) : {})
      },
      query: {
        dimensions,
        timeRange: params.startTime && params.endTime ? {
          start: params.startTime,
          end: params.endTime
        } : undefined,
        filters: {
          serverName: params.serverName,
          serverId: params.serverId,
          userId: params.userId,
          clientId: params.clientId,
          clientType: params.clientType,
          payloadMethod: params.payloadMethod,
          payloadToolName: params.payloadToolName,
          sourceIP: params.sourceIP,
          policyId: params.policyId,
          filterName: params.filterName,
          seen: params.seen,
          severity: params.severity
        }
      }
    };

    return JsonResponse.payloadResponse<DimensionsPayload>('dimensions', result);
  } catch (error) {
    logger.error('Error in dimensions endpoint:', error);
    return JsonResponse.errorResponse(500, 'An error occurred');
  }
}