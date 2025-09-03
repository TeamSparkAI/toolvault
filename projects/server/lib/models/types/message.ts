import { MessageOrigin } from "@/lib/jsonrpc";
import { ClientType } from "@/lib/types/clientType";

export interface MessageData {
    messageId: number;
    timestamp: string;
    timestampResult?: string;
    userId: string;
    clientId?: number;
    clientType?: ClientType;
    sourceIP: string;
    serverId: number;
    serverName: string;
    sessionId: string;
    origin: MessageOrigin;
    payloadMessageId: string;
    payloadMethod: string;
    payloadToolName: string;
    payloadParams: any;
    payloadResult: any;
    payloadError: any;
    createdAt: string;
    alerts?: boolean;
}

// Optimized data interface for message list responses
export interface MessageListItemData {
    messageId: number;
    timestamp: string;
    timestampResult?: string;
    userId: string;
    clientId?: number;
    clientType?: ClientType;
    sourceIP: string;
    serverId?: number;
    serverName: string;
    sessionId: string;
    origin: MessageOrigin;
    payloadMessageId: string;
    payloadMethod: string;
    payloadToolName: string;
    hasError: boolean; // Computed field based on payloadError presence
    createdAt: string;
    alerts?: boolean;
}

export interface MessageFilter {
    origin?: MessageOrigin;
    serverName?: string;
    payloadMethod?: string;
    payloadMessageId?: string;
    payloadToolName?: string;
    userId?: string;
    clientId?: number;
    serverId?: number;
    clientType?: string;
    sourceIP?: string;
    sessionId?: string;
    startTime?: string;
    endTime?: string;
}

export interface MessagePagination {
    sort: 'asc' | 'desc';
    limit: number;
    cursor?: number;
}

export interface MessageListResult {
    messages: MessageListItemData[];
    pagination: {
        total: number;
        remaining: number;
        hasMore: boolean;
        nextCursor: number | null;
        limit: number;
        sort: 'asc' | 'desc';
    };
}