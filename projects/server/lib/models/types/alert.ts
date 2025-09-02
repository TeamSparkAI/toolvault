import { MessageOrigin } from "@/lib/jsonrpc";
import { ClientType } from "@/lib/types/clientType";
import { PolicyCondition } from "@/lib/models/types/policy";
import { Finding } from "@/lib/policy-engine/types/core";

export interface AlertData {
    alertId: number;
    messageId: number;
    policyId: number;
    origin: MessageOrigin;
    condition: PolicyCondition;  // The condition that triggered this alert
    findings: Finding[];         // The findings from the condition
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
    conditionName?: string;
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