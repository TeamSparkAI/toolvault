import { AlertModel } from '../alert';
import { AlertData, AlertFilter, AlertPagination, AlertListResult, AlertReadData } from '../types/alert';
import { DatabaseClient } from './database';

export class SqliteAlertModel extends AlertModel {
    private db: DatabaseClient;

    constructor(db: DatabaseClient) {
        super();
        this.db = db;
    }

    async findById(alertId: number): Promise<AlertReadData | null> {
        const result = await this.db.query<AlertReadData & { condition: string; findings: string }>(
            `SELECT a.*, p.severity as policySeverity,
                    m.serverId, m.clientId, c.type as clientType
             FROM alerts a 
             JOIN policies p ON a.policyId = p.policyId 
             JOIN messages m ON a.messageId = m.messageId
             LEFT JOIN clients c ON m.clientId = c.clientId
             WHERE a.alertId = ?`,
            [alertId]
        );
        if (!result.rows[0]) return null;
        
        // Deserialize JSON fields
        const alert = result.rows[0];
        return {
            ...alert,
            condition: alert.condition ? JSON.parse(alert.condition) : null,
            findings: alert.findings ? JSON.parse(alert.findings) : null
        };
    }

    async list(filter: AlertFilter, pagination: AlertPagination): Promise<AlertListResult> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filter.messageId) {
            conditions.push('a.messageId = ?');
            params.push(filter.messageId);
        }
        if (filter.policyId) {
            conditions.push('a.policyId = ?');
            params.push(filter.policyId);
        }
        if (filter.conditionName) {
            conditions.push('a.conditionName = ?');
            params.push(filter.conditionName);
        }
        if (filter.seen !== undefined) {
            conditions.push(filter.seen ? 'a.seenAt IS NOT NULL' : 'a.seenAt IS NULL');
        }
        if (filter.severity !== undefined) {
            conditions.push('p.severity = ?');
            params.push(filter.severity);
        }
        if (filter.startTime) {
            conditions.push('a.createdAt >= ?');
            params.push(filter.startTime);
        }
        if (filter.endTime) {
            conditions.push('a.createdAt <= ?');
            params.push(filter.endTime);
        }
        if (filter.serverId) {
            conditions.push('m.serverId = ?');
            params.push(filter.serverId);
        }
        if (filter.clientId) {
            conditions.push('m.clientId = ?');
            params.push(filter.clientId);
        }
        if (filter.clientType) {
            conditions.push('c.type = ?');
            params.push(filter.clientType);
        }
        if (pagination.cursor) {
            conditions.push(`a.alertId ${pagination.sort === 'asc' ? '>' : '<'} ?`);
            params.push(pagination.cursor);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const orderClause = `ORDER BY a.alertId ${pagination.sort}`;
        const limitClause = `LIMIT ?`;

        const queryParams = [
            ...params,
            pagination.limit
        ];

        const alerts = await this.db.query<AlertReadData & { condition: string; findings: string }>(
            `SELECT a.*, p.severity as policySeverity,
                    m.serverId, m.clientId, c.type as clientType
             FROM alerts a 
             JOIN policies p ON a.policyId = p.policyId 
             JOIN messages m ON a.messageId = m.messageId
             LEFT JOIN clients c ON m.clientId = c.clientId
             ${whereClause} ${orderClause} ${limitClause}`,
            queryParams
        );

        // Deserialize JSON fields for each alert
        alerts.rows = alerts.rows.map(alert => ({
            ...alert,
            condition: alert.condition ? JSON.parse(alert.condition) : null,
            findings: alert.findings ? JSON.parse(alert.findings) : null
        }));

        const total = await this.db.query<{ count: number }>(
            `SELECT COUNT(*) as count 
             FROM alerts a 
             JOIN policies p ON a.policyId = p.policyId 
             JOIN messages m ON a.messageId = m.messageId
             LEFT JOIN clients c ON m.clientId = c.clientId
             ${whereClause}`,
            params
        );

        const hasMore = alerts.rows.length === pagination.limit;
        const nextCursor = hasMore ? alerts.rows[alerts.rows.length - 1].alertId : null;

        return {
            alerts: alerts.rows,
            pagination: {
                total: total.rows[0].count,
                remaining: total.rows[0].count - alerts.rows.length,
                hasMore,
                nextCursor,
                limit: pagination.limit,
                sort: pagination.sort
            }
        };
    }

    async create(data: Omit<AlertData, 'alertId' | 'createdAt' | 'seenAt'>): Promise<AlertReadData> {
        const result = await this.db.query<AlertData>(
            `INSERT INTO alerts (messageId, policyId, origin, condition, findings, timestamp) 
             VALUES (?, ?, ?, ?, ?, ?) 
             RETURNING *`,
            [data.messageId, data.policyId, data.origin, JSON.stringify(data.condition), JSON.stringify(data.findings), data.timestamp]
        );
        
        // After creating, fetch the full record with policy data
        return this.findById(result.rows[0].alertId) as Promise<AlertReadData>;
    }

    async markAsSeen(alertId: number): Promise<AlertReadData> {
        await this.db.execute(
            'UPDATE alerts SET seenAt = CURRENT_TIMESTAMP WHERE alertId = ?',
            [alertId]
        );
        return this.findById(alertId) as Promise<AlertReadData>;
    }

    async markAsUnseen(alertId: number): Promise<AlertReadData> {
        await this.db.execute(
            'UPDATE alerts SET seenAt = NULL WHERE alertId = ?',
            [alertId]
        );
        return this.findById(alertId) as Promise<AlertReadData>;
    }

    async markAll(filter: AlertFilter & { seen: boolean }): Promise<void> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filter.messageId) {
            conditions.push('a.messageId = ?');
            params.push(filter.messageId);
        }
        if (filter.policyId) {
            conditions.push('a.policyId = ?');
            params.push(filter.policyId);
        }
        if (filter.conditionName) {
            conditions.push('a.conditionName = ?');
            params.push(filter.conditionName);
        }
        if (filter.startTime) {
            conditions.push('a.createdAt >= ?');
            params.push(filter.startTime);
        }
        if (filter.endTime) {
            conditions.push('a.createdAt <= ?');
            params.push(filter.endTime);
        }
        if (filter.serverId) {
            conditions.push('m.serverId = ?');
            params.push(filter.serverId);
        }
        if (filter.clientId) {
            conditions.push('m.clientId = ?');
            params.push(filter.clientId);
        }
        if (filter.clientType) {
            conditions.push('c.type = ?');
            params.push(filter.clientType);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const seenValue = filter.seen ? 'CURRENT_TIMESTAMP' : 'NULL';

        const query = `
            UPDATE alerts 
            SET seenAt = ${seenValue}
            WHERE alertId IN (
                SELECT a.alertId
                FROM alerts a
                JOIN messages m ON a.messageId = m.messageId
                LEFT JOIN clients c ON m.clientId = c.clientId
                ${whereClause}
            )
        `;

        await this.db.query(query, params);
    }

    async timeSeries(params: {
        dimension: string;
        timeUnit: 'hour' | 'day' | 'week' | 'month';
        policyId?: number;
        conditionName?: string;
        seen?: boolean;
        severity?: number;
        startTime?: string;
        endTime?: string;
        serverId?: number;
        clientId?: number;
        clientType?: string;
    }): Promise<Array<{ timestamp: string; counts: Record<string, number> }>> {
        const conditions: string[] = [];
        const queryParams: any[] = [];

        if (params.policyId) {
            conditions.push('a.policyId = ?');
            queryParams.push(params.policyId);
        }
        if (params.conditionName) {
            conditions.push('a.conditionName = ?');
            queryParams.push(params.conditionName);
        }
        if (params.seen !== undefined) {
            conditions.push('a.seenAt IS ' + (params.seen ? 'NOT NULL' : 'NULL'));
        }
        if (params.severity !== undefined) {
            conditions.push('p.severity = ?');
            queryParams.push(params.severity);
        }
        if (params.startTime) {
            conditions.push('a.timestamp >= ?');
            queryParams.push(params.startTime);
        }
        if (params.endTime) {
            conditions.push('a.timestamp <= ?');
            queryParams.push(params.endTime);
        }
        if (params.serverId) {
            conditions.push('m.serverId = ?');
            queryParams.push(params.serverId);
        }
        if (params.clientId) {
            conditions.push('m.clientId = ?');
            queryParams.push(params.clientId);
        }
        if (params.clientType) {
            conditions.push('c.type = ?');
            queryParams.push(params.clientType);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        let timeFormat: string;
        switch (params.timeUnit) {
            case 'hour': timeFormat = '%Y-%m-%d %H:00:00'; break;
            case 'day': timeFormat = '%Y-%m-%d'; break;
            case 'week': timeFormat = '%Y-%W'; break;
            case 'month': timeFormat = '%Y-%m'; break;
            default: timeFormat = '%Y-%m-%d';
        }

        // Map dimension to actual column name
        let dimensionColumn: string;
        switch (params.dimension) {
            case 'policyId': dimensionColumn = 'a.policyId'; break;
            case 'conditionName': dimensionColumn = 'a.conditionName'; break;
            case 'seen': dimensionColumn = 'CASE WHEN a.seenAt IS NOT NULL THEN 1 ELSE 0 END'; break;
            case 'severity': dimensionColumn = 'p.severity'; break;
            case 'serverId': dimensionColumn = 'm.serverId'; break;
            case 'clientId': dimensionColumn = 'm.clientId'; break;
            case 'clientType': dimensionColumn = 'c.type'; break;
            default: dimensionColumn = params.dimension;
        }

        const query = `
            SELECT 
                ${dimensionColumn} as dimension,
                strftime('${timeFormat}', a.timestamp) as timestamp,
                COUNT(*) as count
            FROM alerts a
            JOIN policies p ON a.policyId = p.policyId
            JOIN messages m ON a.messageId = m.messageId
            LEFT JOIN clients c ON m.clientId = c.clientId
            ${whereClause}
            GROUP BY ${dimensionColumn}, strftime('${timeFormat}', a.timestamp)
            HAVING ${dimensionColumn} IS NOT NULL
            ORDER BY timestamp, ${dimensionColumn}
        `;

        const results = await this.db.query(query, queryParams);

        // Transform results to group by timestamp first
        const dataByTimestamp = results.rows.reduce((acc: Record<string, Record<string, number>>, row: any) => {
            if (!acc[row.timestamp]) {
                acc[row.timestamp] = {};
            }
            acc[row.timestamp][row.dimension] = row.count;
            return acc;
        }, {});

        return Object.entries(dataByTimestamp).map(([timestamp, counts]) => ({
            timestamp,
            counts
        }));
    }

    async aggregate(params: {
        dimension: string;
        policyId?: number;
        conditionName?: string;
        seen?: boolean;
        severity?: number;
        startTime?: string;
        endTime?: string;
        serverId?: number;
        clientId?: number;
        clientType?: string;
    }): Promise<Array<{ value: string; count: number }>> {
        const conditions: string[] = [];
        const queryParams: any[] = [];

        if (params.policyId) {
            conditions.push('a.policyId = ?');
            queryParams.push(params.policyId);
        }
        if (params.conditionName) {
            conditions.push('a.conditionName = ?');
            queryParams.push(params.conditionName);
        }
        if (params.seen !== undefined) {
            conditions.push('a.seenAt IS ' + (params.seen ? 'NOT NULL' : 'NULL'));
        }
        if (params.severity !== undefined) {
            conditions.push('p.severity = ?');
            queryParams.push(params.severity);
        }
        if (params.startTime) {
            conditions.push('a.timestamp >= ?');
            queryParams.push(params.startTime);
        }
        if (params.endTime) {
            conditions.push('a.timestamp <= ?');
            queryParams.push(params.endTime);
        }
        if (params.serverId) {
            conditions.push('m.serverId = ?');
            queryParams.push(params.serverId);
        }
        if (params.clientId) {
            conditions.push('m.clientId = ?');
            queryParams.push(params.clientId);
        }
        if (params.clientType) {
            conditions.push('c.type = ?');
            queryParams.push(params.clientType);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Map dimension to actual column name
        let dimensionColumn: string;
        switch (params.dimension) {
            case 'policyId': dimensionColumn = 'a.policyId'; break;
            case 'conditionName': dimensionColumn = 'a.conditionName'; break;
            case 'seen': dimensionColumn = 'CASE WHEN a.seenAt IS NOT NULL THEN 1 ELSE 0 END'; break;
            case 'severity': dimensionColumn = 'p.severity'; break;
            case 'serverId': dimensionColumn = 'm.serverId'; break;
            case 'clientId': dimensionColumn = 'm.clientId'; break;
            case 'clientType': dimensionColumn = 'c.type'; break;
            default: dimensionColumn = params.dimension;
        }

        const query = `
            SELECT 
                ${dimensionColumn} as value,
                COUNT(*) as count
            FROM alerts a
            JOIN policies p ON a.policyId = p.policyId
            JOIN messages m ON a.messageId = m.messageId
            LEFT JOIN clients c ON m.clientId = c.clientId
            ${whereClause}
            GROUP BY ${dimensionColumn}
            HAVING ${dimensionColumn} IS NOT NULL
            ORDER BY count DESC
        `;

        const results = await this.db.query(query, queryParams);
        return results.rows.map(row => ({
            value: String(row.value),
            count: Number(row.count)
        }));
    }

    async getDimensionValues(params: {
        dimensions: string[];
        policyId?: number;
        conditionName?: string;
        seen?: boolean;
        startTime?: string;
        endTime?: string;
        serverId?: number;
        clientId?: number;
        clientType?: string;
    }): Promise<Record<string, string[]>> {
        const conditions: string[] = [];
        const queryParams: any[] = [];
        const result: Record<string, string[]> = {};

        if (params.policyId) {
            conditions.push('a.policyId = ?');
            queryParams.push(params.policyId);
        }
        if (params.conditionName) {
            conditions.push('a.conditionName = ?');
            queryParams.push(params.conditionName);
        }
        if (params.seen !== undefined) {
            conditions.push(params.seen ? 'a.seenAt IS NOT NULL' : 'a.seenAt IS NULL');
        }
        if (params.startTime) {
            conditions.push('a.createdAt >= ?');
            queryParams.push(params.startTime);
        }
        if (params.endTime) {
            conditions.push('a.createdAt <= ?');
            queryParams.push(params.endTime);
        }
        if (params.serverId) {
            conditions.push('m.serverId = ?');
            queryParams.push(params.serverId);
        }
        if (params.clientId) {
            conditions.push('m.clientId = ?');
            queryParams.push(params.clientId);
        }
        if (params.clientType) {
            conditions.push('c.type = ?');
            queryParams.push(params.clientType);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        for (const dimension of params.dimensions) {
            let dimensionColumn: string;

            switch (dimension) {
                case 'policyId': dimensionColumn = 'a.policyId'; break;
                case 'conditionName': dimensionColumn = 'a.conditionName'; break;
                case 'seen': dimensionColumn = 'CASE WHEN a.seenAt IS NOT NULL THEN 1 ELSE 0 END'; break;
                case 'severity': dimensionColumn = 'p.severity'; break;
                case 'serverId': dimensionColumn = 'm.serverId'; break;
                case 'clientId': dimensionColumn = 'm.clientId'; break;
                case 'clientType': dimensionColumn = 'c.type'; break;
                default: dimensionColumn = dimension;
            }

            const query = `
                SELECT DISTINCT ${dimensionColumn} as value
                FROM alerts a
                JOIN policies p ON a.policyId = p.policyId
                JOIN messages m ON a.messageId = m.messageId
                LEFT JOIN clients c ON m.clientId = c.clientId
                ${whereClause}
                AND ${dimensionColumn} IS NOT NULL
                ORDER BY value
            `;

            const values = await this.db.query<{ value: string }>(query, queryParams);

            result[dimension] = values.rows.map(row => String(row.value));
        }

        return result;
    }

    async analyze(): Promise<void> {
        // No-op for now
    }

    async deleteOldAlerts(beforeDate: string): Promise<{ deletedCount: number }> {
        const result = await this.db.query<{ deletedCount: number }>(
            'DELETE FROM alerts WHERE createdAt < ? RETURNING COUNT(*) as deletedCount',
            [beforeDate]
        );
        
        // If RETURNING is not supported, use a separate count query
        if (!result.rows[0]) {
            const countResult = await this.db.query<{ deletedCount: number }>(
                'SELECT COUNT(*) as deletedCount FROM alerts WHERE createdAt < ?',
                [beforeDate]
            );
            await this.db.execute('DELETE FROM alerts WHERE createdAt < ?', [beforeDate]);
            return { deletedCount: countResult.rows[0].deletedCount };
        }
        
        return { deletedCount: result.rows[0].deletedCount };
    }
} 