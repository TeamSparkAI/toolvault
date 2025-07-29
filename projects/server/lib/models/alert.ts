import { AlertData, AlertFilter, AlertListResult, AlertPagination, AlertReadData } from "./types/alert";

export abstract class AlertModel {
    abstract findById(alertId: number): Promise<AlertReadData | null>;
    abstract list(filter: AlertFilter, pagination: AlertPagination): Promise<AlertListResult>;
    abstract create(data: Omit<AlertData, 'alertId' | 'createdAt' | 'seenAt'>): Promise<AlertReadData>;
    abstract markAsSeen(alertId: number): Promise<AlertReadData>;
    abstract markAsUnseen(alertId: number): Promise<AlertReadData>;
    abstract markAll(filter: AlertFilter & { seen: boolean }): Promise<void>;
    abstract timeSeries(params: {
        dimension: string;
        timeUnit: 'hour' | 'day' | 'week' | 'month';
        policyId?: number;
        filterName?: string;
        seen?: boolean;
        startTime?: string;
        endTime?: string;
        sort?: 'asc' | 'desc';
        cursor?: number;
        serverId?: number;
        clientId?: number;
        clientType?: string;
    }): Promise<Array<{ timestamp: string; counts: Record<string, number> }>>;
    abstract aggregate(params: {
        dimension: string;
        policyId?: number;
        filterName?: string;
        seen?: boolean;
        startTime?: string;
        endTime?: string;
        serverId?: number;
        clientId?: number;
        clientType?: string;
    }): Promise<Array<{ value: string; count: number }>>;
    abstract getDimensionValues(params: {
        dimensions: string[];
        policyId?: number;
        filterName?: string;
        seen?: boolean;
        startTime?: string;
        endTime?: string;
        serverId?: number;
        clientId?: number;
        clientType?: string;
    }): Promise<Record<string, string[]>>;
    abstract analyze(): Promise<void>;
    abstract deleteOldAlerts(beforeDate: string): Promise<{ deletedCount: number }>;
} 