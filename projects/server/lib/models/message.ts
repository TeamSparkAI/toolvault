import { MessageData, MessageFilter, MessageListResult, MessagePagination } from "./types/message";


export abstract class MessageModel {
    abstract findById(messageId: number): Promise<MessageData | null>;
    abstract list(filter: MessageFilter, pagination: MessagePagination): Promise<MessageListResult>;
    abstract create(data: Omit<MessageData, 'messageId' | 'createdAt'>): Promise<MessageData>;
    abstract update(messageId: number, data: Partial<MessageData>): Promise<MessageData>;
    abstract delete(messageId: number): Promise<void>;
    abstract timeSeries(params: {
        dimension: string;
        timeUnit: 'hour' | 'day' | 'week' | 'month';
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
    }): Promise<Array<{ timestamp: string; counts: Record<string, number> }>>;
    abstract aggregate(params: {
        dimension: string;
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
    }): Promise<Array<{ value: string; count: number }>>;
    abstract getDimensionValues(params: {
        dimensions: string[];
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
    }): Promise<Record<string, string[]>>;
    abstract analyze(): Promise<void>;
    abstract deleteOldMessagesWithoutAlerts(beforeDate: string): Promise<{ deletedCount: number; preservedCount: number }>;
    abstract countMessagesWithAlerts(beforeDate: string): Promise<number>;
} 