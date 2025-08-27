import { MessageModel } from '../message';
import { DatabaseClient } from '../sqlite/database';
import { ClientType } from '../../types/clientType';
import { MessageOrigin } from '../../jsonrpc';
import { logger } from '@/lib/logging/server';
import { MessageData, MessageFilter, MessageListResult, MessagePagination } from '../types/message';

export class SqliteMessageModel extends MessageModel {
    private db: DatabaseClient;

    constructor(db: DatabaseClient) {
        super();
        this.db = db;
    }

    async findById(messageId: number): Promise<MessageData | null> {
        const result = await this.db.query<MessageData & { clientType: string; hasAlerts: number }>(
            `SELECT m.*, c.type as clientType, 
                    CASE WHEN a.alertId IS NOT NULL THEN 1 ELSE 0 END as hasAlerts
             FROM messages m 
             LEFT JOIN clients c ON m.clientId = c.clientId 
             LEFT JOIN alerts a ON m.messageId = a.messageId
             WHERE m.messageId = ?`,
            [messageId]
        );
        if (!result.rows[0]) return null;

        // Deserialize JSON fields
        const msg = result.rows[0];
        return {
            ...msg,
            clientType: msg.clientType as ClientType,
            origin: msg.origin as MessageOrigin,
            payloadParams: msg.payloadParams ? JSON.parse(msg.payloadParams) : null,
            payloadResult: msg.payloadResult ? JSON.parse(msg.payloadResult) : null,
            payloadError: msg.payloadError ? JSON.parse(msg.payloadError) : null,
            alerts: msg.hasAlerts === 1
        };
    }

    async list(filter: MessageFilter, pagination: MessagePagination): Promise<MessageListResult> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filter.origin) {
            conditions.push('m.origin = ?');
            params.push(filter.origin);
        }
        if (filter.serverName) {
            conditions.push('m.serverName = ?');
            params.push(filter.serverName);
        }
        if (filter.serverId) {
            conditions.push('m.serverId = ?');
            params.push(filter.serverId);
        }
        if (filter.payloadMethod) {
            conditions.push('m.payloadMethod = ?');
            params.push(filter.payloadMethod);
        }
        if (filter.payloadMessageId) {
            conditions.push('m.payloadMessageId = ?');
            params.push(filter.payloadMessageId);
        }
        if (filter.payloadToolName) {
            conditions.push('m.payloadToolName = ?');
            params.push(filter.payloadToolName);
        }
        if (filter.userId) {
            conditions.push('m.userId = ?');
            params.push(filter.userId);
        }
        if (filter.clientId) {
            conditions.push('m.clientId = ?');
            params.push(filter.clientId);
        }
        if (filter.clientType) {
            conditions.push('c.type = ?');
            params.push(filter.clientType);
        }
        if (filter.sourceIP) {
            conditions.push('m.sourceIP = ?');
            params.push(filter.sourceIP);
        }
        if (filter.sessionId) {
            conditions.push('m.sessionId = ?');
            params.push(filter.sessionId);
        }
        if (filter.startTime) {
            conditions.push('m.timestamp >= ?');
            params.push(filter.startTime);
        }
        if (filter.endTime) {
            conditions.push('m.timestamp <= ?');
            params.push(filter.endTime);
        }
        if (pagination.cursor) {
            conditions.push(`m.messageId ${pagination.sort === 'asc' ? '>' : '<'} ?`);
            params.push(pagination.cursor);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const orderClause = `ORDER BY m.messageId ${pagination.sort}`;
        const limitClause = `LIMIT ?`;

        const queryParams = [
            ...params,
            pagination.limit
        ];

        const messages = await this.db.query<{
            messageId: number;
            timestamp: string;
            timestampResult?: string;
            userId: string;
            clientId?: number;
            sourceIP: string;
            serverId?: number;
            serverName: string;
            sessionId: string;
            origin: string;
            payloadMessageId: string;
            payloadMethod: string;
            payloadToolName: string;
            createdAt: string;
            clientType: string;
            hasAlerts: number;
            hasError: number;
        }>(
            `SELECT m.messageId, m.timestamp, m.timestampResult, m.userId, m.clientId, m.sourceIP, 
                    m.serverId, m.serverName, m.sessionId, m.origin, m.payloadMessageId, m.payloadMethod, 
                    m.payloadToolName, m.createdAt, c.type as clientType,
                    CASE WHEN EXISTS (SELECT 1 FROM alerts a WHERE a.messageId = m.messageId) THEN 1 ELSE 0 END as hasAlerts,
                    CASE WHEN m.payloadError IS NULL THEN 0 ELSE 1 END as hasError
             FROM messages m 
             LEFT JOIN clients c ON m.clientId = c.clientId 
             ${whereClause} ${orderClause} ${limitClause}`,
            queryParams
        );

        // Transform to MessageListItemData format
        const messageItems = messages.rows.map((msg) => ({
            messageId: msg.messageId,
            timestamp: msg.timestamp,
            timestampResult: msg.timestampResult,
            userId: msg.userId,
            clientId: msg.clientId,
            clientType: msg.clientType as ClientType,
            sourceIP: msg.sourceIP,
            serverId: msg.serverId,
            serverName: msg.serverName,
            sessionId: msg.sessionId,
            origin: msg.origin as MessageOrigin,
            payloadMessageId: msg.payloadMessageId,
            payloadMethod: msg.payloadMethod,
            payloadToolName: msg.payloadToolName,
            hasError: msg.hasError === 1,
            createdAt: msg.createdAt,
            alerts: msg.hasAlerts === 1
        }));

        const total = await this.db.query<{ count: number }>(
            `SELECT COUNT(*) as count 
             FROM messages m 
             LEFT JOIN clients c ON m.clientId = c.clientId 
             ${whereClause}`,
            params
        );

        const lastMessage = messageItems[messageItems.length - 1];
        const hasMore = messageItems.length === pagination.limit;
        const nextCursor = hasMore ? lastMessage.messageId : null;

        return {
            messages: messageItems,
            pagination: {
                total: total.rows[0].count,
                remaining: total.rows[0].count - messageItems.length,
                hasMore,
                nextCursor,
                limit: pagination.limit,
                sort: pagination.sort
            }
        };
    }

    async create(data: Omit<MessageData, 'messageId' | 'createdAt'>): Promise<MessageData> {
        await this.db.execute(
            `INSERT INTO messages (
                timestamp, origin, userId, clientId, sourceIP, serverName, serverId, sessionId,
                payloadMessageId, payloadMethod, payloadToolName, payloadParams, payloadResult, payloadError
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.timestamp,
                data.origin,
                data.userId,
                data.clientId || null,
                data.sourceIP,
                data.serverName,
                data.serverId || null,
                data.sessionId,
                data.payloadMessageId,
                data.payloadMethod,
                data.payloadToolName,
                data.payloadParams ? JSON.stringify(data.payloadParams) : null,
                data.payloadResult ? JSON.stringify(data.payloadResult) : null,
                data.payloadError ? JSON.stringify(data.payloadError) : null
            ]
        );

        const result = await this.db.query<{ messageId: number }>('SELECT last_insert_rowid() as messageId');
        if (!result.rows[0]) {
            throw new Error('Failed to get last insert ID');
        }

        return this.findById(result.rows[0].messageId) as Promise<MessageData>;
    }

    async update(messageId: number, payload: { payloadResult?: object | undefined; payloadError?: object | undefined; timestampResult?: string }): Promise<MessageData> {
        const updates: string[] = [];
        const params: any[] = [];

        if (payload.payloadResult !== undefined) {
            updates.push('payloadResult = ?');
            params.push(payload.payloadResult ? JSON.stringify(payload.payloadResult) : null);
        }
        if (payload.payloadError !== undefined) {
            updates.push('payloadError = ?');
            params.push(payload.payloadError ? JSON.stringify(payload.payloadError) : null);
        }
        if (payload.timestampResult !== undefined) {
            updates.push('timestampResult = ?');
            params.push(payload.timestampResult);
        }

        if (updates.length === 0) {
            return this.findById(messageId) as Promise<MessageData>;
        }

        await this.db.execute(
            `UPDATE messages SET ${updates.join(', ')} WHERE messageId = ?`,
            [...params, messageId]
        );

        return this.findById(messageId) as Promise<MessageData>;
    }

    async delete(messageId: number): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM messages WHERE messageId = ?', [messageId]);
        return result.changes > 0;
    }

    async timeSeries(params: {
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
    }): Promise<Array<{ timestamp: string; counts: Record<string, number> }>> {
        const conditions: string[] = [];
        const queryParams: any[] = [];

        if (params.serverName) {
            conditions.push('m.serverName = ?');
            queryParams.push(params.serverName);
        }
        if (params.serverId) {
            conditions.push('m.serverId = ?');
            queryParams.push(params.serverId);
        }
        if (params.userId) {
            conditions.push('m.userId = ?');
            queryParams.push(params.userId);
        }
        if (params.clientId) {
            conditions.push('m.clientId = ?');
            queryParams.push(params.clientId);
        }
        if (params.clientType) {
            conditions.push('c.type = ?');
            queryParams.push(params.clientType);
        }
        if (params.payloadMethod) {
            conditions.push('m.payloadMethod = ?');
            queryParams.push(params.payloadMethod);
        }
        if (params.payloadToolName) {
            conditions.push('m.payloadToolName = ?');
            queryParams.push(params.payloadToolName);
        }
        if (params.sourceIP) {
            conditions.push('m.sourceIP = ?');
            queryParams.push(params.sourceIP);
        }
        if (params.startTime) {
            conditions.push("date(m.timestamp) >= date(?)");
            queryParams.push(params.startTime);
        }
        if (params.endTime) {
            conditions.push("date(m.timestamp) <= date(?)");
            queryParams.push(params.endTime);
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
            case 'serverName': dimensionColumn = 'm.serverName'; break;
            case 'serverId': dimensionColumn = 'm.serverId'; break;
            case 'payloadMethod': dimensionColumn = 'm.payloadMethod'; break;
            case 'payloadToolName': dimensionColumn = 'm.payloadToolName'; break;
            case 'userId': dimensionColumn = 'm.userId'; break;
            case 'clientId': dimensionColumn = 'm.clientId'; break;
            case 'clientType': dimensionColumn = 'c.type'; break;
            case 'sourceIP': dimensionColumn = 'm.sourceIP'; break;
            default: dimensionColumn = params.dimension;
        }

        const query = `
            SELECT 
                ${dimensionColumn} as dimension,
                strftime('${timeFormat}', m.timestamp) as timestamp,
                COUNT(*) as count
            FROM messages m
            LEFT JOIN clients c ON m.clientId = c.clientId
            ${whereClause}
            GROUP BY ${dimensionColumn}, strftime('${timeFormat}', m.timestamp)
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
    }): Promise<Array<{ value: string; count: number }>> {
        const conditions: string[] = [];
        const queryParams: any[] = [];

        if (params.serverName) {
            conditions.push('m.serverName = ?');
            queryParams.push(params.serverName);
        }
        if (params.serverId) {
            conditions.push('m.serverId = ?');
            queryParams.push(params.serverId);
        }
        if (params.userId) {
            conditions.push('m.userId = ?');
            queryParams.push(params.userId);
        }
        if (params.clientId) {
            conditions.push('m.clientId = ?');
            queryParams.push(params.clientId);
        }
        if (params.clientType) {
            conditions.push('c.type = ?');
            queryParams.push(params.clientType);
        }
        if (params.payloadMethod) {
            conditions.push('m.payloadMethod = ?');
            queryParams.push(params.payloadMethod);
        }
        if (params.payloadToolName) {
            conditions.push('m.payloadToolName = ?');
            queryParams.push(params.payloadToolName);
        }
        if (params.sourceIP) {
            conditions.push('m.sourceIP = ?');
            queryParams.push(params.sourceIP);
        }
        if (params.startTime) {
            conditions.push("date(m.timestamp) >= date(?)");
            queryParams.push(params.startTime);
        }
        if (params.endTime) {
            conditions.push("date(m.timestamp) <= date(?)");
            queryParams.push(params.endTime);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Map dimension to actual column name
        let dimensionColumn: string;
        switch (params.dimension) {
            case 'serverName': dimensionColumn = 'm.serverName'; break;
            case 'serverId': dimensionColumn = 'm.serverId'; break;
            case 'payloadMethod': dimensionColumn = 'm.payloadMethod'; break;
            case 'payloadToolName': dimensionColumn = 'm.payloadToolName'; break;
            case 'userId': dimensionColumn = 'm.userId'; break;
            case 'clientId': dimensionColumn = 'm.clientId'; break;
            case 'clientType': dimensionColumn = 'c.type'; break;
            case 'sourceIP': dimensionColumn = 'm.sourceIP'; break;
            default: dimensionColumn = params.dimension;
        }

        const query = `
            SELECT 
                ${dimensionColumn} as value,
                COUNT(*) as count
            FROM messages m
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
    }): Promise<Record<string, string[]>> {
        const conditions: string[] = [];
        const queryParams: any[] = [];

        if (params.serverName) {
            conditions.push('m.serverName = ?');
            queryParams.push(params.serverName);
        }
        if (params.serverId) {
            conditions.push('m.serverId = ?');
            queryParams.push(params.serverId);
        }
        if (params.userId) {
            conditions.push('m.userId = ?');
            queryParams.push(params.userId);
        }
        if (params.clientId) {
            conditions.push('m.clientId = ?');
            queryParams.push(params.clientId);
        }
        if (params.clientType) {
            conditions.push('c.type = ?');
            queryParams.push(params.clientType);
        }
        if (params.payloadMethod) {
            conditions.push('m.payloadMethod = ?');
            queryParams.push(params.payloadMethod);
        }
        if (params.payloadToolName) {
            conditions.push('m.payloadToolName = ?');
            queryParams.push(params.payloadToolName);
        }
        if (params.sourceIP) {
            conditions.push('m.sourceIP = ?');
            queryParams.push(params.sourceIP);
        }
        if (params.startTime) {
            conditions.push("date(m.timestamp) >= date(?)");
            queryParams.push(params.startTime);
        }
        if (params.endTime) {
            conditions.push("date(m.timestamp) <= date(?)");
            queryParams.push(params.endTime);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Map dimensions to actual column names
        const dimensionColumns = params.dimensions.map(dim => {
            switch (dim) {
                case 'serverName': return 'm.serverName';
                case 'serverId': return 'm.serverId';
                case 'payloadMethod': return 'm.payloadMethod';
                case 'payloadToolName': return 'm.payloadToolName';
                case 'userId': return 'm.userId';
                case 'clientId': return 'm.clientId';
                case 'clientType': return 'c.type';
                case 'sourceIP': return 'm.sourceIP';
                default: return dim;
            }
        });

        const queries = dimensionColumns.map(column => `
            SELECT DISTINCT ${column} as value
            FROM messages m
            LEFT JOIN clients c ON m.clientId = c.clientId
            ${whereClause}
            AND ${column} IS NOT NULL
            ORDER BY ${column}
        `);

        const results = await Promise.all(
            queries.map(query => this.db.query(query, queryParams))
        );

        /*
        logger.debug('Dimension results:', {
            dimensions: params.dimensions,
            results: results.map(r => r.rows.length)
        });
        */

        const response = params.dimensions.reduce((acc, dim, i) => {
            acc[dim] = results[i].rows.map(row => String(row.value));
            return acc;
        }, {} as Record<string, string[]>);

        // logger.debug('Final response:', response);
        return response;
    }

    async analyze(): Promise<void> {
        await this.db.analyze();
    }

    async deleteOldMessagesWithoutAlerts(beforeDate: string): Promise<{ deletedCount: number; preservedCount: number }> {
        // First, count messages that would be preserved (have alerts)
        const preservedCountResult = await this.db.query<{ preservedCount: number }>(
            `SELECT COUNT(DISTINCT m.messageId) as preservedCount
             FROM messages m
             WHERE m.createdAt < ? AND EXISTS (
                 SELECT 1 FROM alerts a WHERE a.messageId = m.messageId
             )`,
            [beforeDate]
        );

        // Delete messages that are old and don't have any alerts
        const deleteResult = await this.db.query<{ deletedCount: number }>(
            `DELETE FROM messages 
             WHERE createdAt < ? AND NOT EXISTS (
                 SELECT 1 FROM alerts a WHERE a.messageId = messages.messageId
             ) RETURNING COUNT(*) as deletedCount`,
            [beforeDate]
        );

        // If RETURNING is not supported, use a separate count query
        if (!deleteResult.rows[0]) {
            const countResult = await this.db.query<{ deletedCount: number }>(
                `SELECT COUNT(*) as deletedCount
                 FROM messages m
                 WHERE m.createdAt < ? AND NOT EXISTS (
                     SELECT 1 FROM alerts a WHERE a.messageId = m.messageId
                 )`,
                [beforeDate]
            );
            await this.db.execute(
                `DELETE FROM messages 
                 WHERE createdAt < ? AND NOT EXISTS (
                     SELECT 1 FROM alerts a WHERE a.messageId = messages.messageId
                 )`,
                [beforeDate]
            );
            return { 
                deletedCount: countResult.rows[0].deletedCount,
                preservedCount: preservedCountResult.rows[0].preservedCount
            };
        }

        return { 
            deletedCount: deleteResult.rows[0].deletedCount,
            preservedCount: preservedCountResult.rows[0].preservedCount
        };
    }

    async countMessagesWithAlerts(beforeDate: string): Promise<number> {
        const result = await this.db.query<{ count: number }>(
            `SELECT COUNT(DISTINCT m.messageId) as count
             FROM messages m
             WHERE m.createdAt < ? AND EXISTS (
                 SELECT 1 FROM alerts a WHERE a.messageId = m.messageId
             )`,
            [beforeDate]
        );
        
        return result.rows[0].count;
    }
}