import { MessageOrigin } from "@/lib/jsonrpc";
import { ClientType } from "@/lib/types/clientType";
import { PolicyAction } from "@/lib/models/types/policy";

export interface FieldMatch {
    fieldPath: string;   // JSON path like "params.args[0].apiKey"
    start: number;       // Start position within the field value
    end: number;         // End position within the field value
    action: PolicyAction;
    actionText: string;
}

export interface AlertData {
    alertId: number;
    messageId: number;
    policyId: number;
    filterName: string;
    origin: MessageOrigin;
    matches: FieldMatch[] | null;
    timestamp: string;
    createdAt: string;
    seenAt: string | null;
}

export interface AlertReadData extends AlertData {
    policySeverity: number;
    serverId: number;
    clientId: number;
    clientType: ClientType;
}

export interface AlertFilter {
    messageId?: number;
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

export interface AlertPagination {
    sort: 'asc' | 'desc';
    limit: number;
    cursor?: number;
}

export interface AlertListResult {
    alerts: AlertReadData[];
    pagination: {
        total: number;
        remaining: number;
        hasMore: boolean;
        nextCursor: number | null;
        limit: number;
        sort: 'asc' | 'desc';
    };
}