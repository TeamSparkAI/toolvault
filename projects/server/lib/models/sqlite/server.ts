import { DatabaseClient } from './database';
import { ServerModel } from '../server';
import { ServerFilter, ServerListResult, ServerPagination, ServerData, ServerPinningInfo } from '../types/server';
import { ServerSecurity } from '@/lib/types/server';
import { getServerCatalogService } from '@/lib/services/serverCatalogService';
import { generateBase32Id } from '../../utils/id';
import { logger } from '@/lib/logging/server';

export interface ServerConfig {
    type: string;
    command: string;
    args: string[];
}

interface ServerRow {
    serverId: number;
    token: string;
    name: string;
    description?: string;
    config: string;
    enabled: boolean;
    security?: string;
    serverCatalogId?: string;
    pinningInfo?: string;
    createdAt: string;
    updatedAt: string;
}

export class SqliteServerModel extends ServerModel {
    private db: DatabaseClient;

    constructor(db: DatabaseClient) {
        super();
        this.db = db;
    }

    private async hydrateCatalogData(server: ServerRow): Promise<ServerData> {
        const serverData: ServerData = {
            ...server,
            config: JSON.parse(server.config),
            security: server.security as ServerSecurity | undefined,
            pinningInfo: server.pinningInfo ? JSON.parse(server.pinningInfo) : undefined
        };

        // Hydrate catalog icon if serverCatalogId is present
        if (server.serverCatalogId) {
            try {
                const catalogService = getServerCatalogService();
                const catalogEntry = await catalogService.getServerById(server.serverCatalogId);
                if (catalogEntry && catalogEntry.icon) {
                    serverData.serverCatalogIcon = catalogEntry.icon;
                }
            } catch (error) {
                logger.warn(`Failed to hydrate catalog data for server ${server.serverId}:`, error);
            }
        }

        return serverData;
    }

    async findById(serverId: number): Promise<ServerData | null> {
        const result = await this.db.query<ServerRow>(
            'SELECT * FROM servers WHERE serverId = ?',
            [serverId]
        );
        if (!result.rows[0]) return null;

        return this.hydrateCatalogData(result.rows[0]);
    }

    async findByToken(token: string): Promise<ServerData | null> {
        const result = await this.db.query<ServerRow>(
            'SELECT * FROM servers WHERE token = ?',
            [token]
        );
        if (!result.rows[0]) return null;
        return this.hydrateCatalogData(result.rows[0]);
    }

    async list(filter: ServerFilter, pagination: ServerPagination): Promise<ServerListResult> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filter.name) {
            conditions.push('name = ?');
            params.push(filter.name);
        }
        if (filter.enabled !== undefined) {
            conditions.push('enabled = ?');
            params.push(filter.enabled);
        }
        if (filter.managed !== undefined) {
            if (filter.managed) {
                conditions.push('security IS NOT "unmanaged"');
            } else {
                conditions.push('security = "unmanaged"');
            }
        }
        if (filter.serverCatalogId) {
            conditions.push('serverCatalogId = ?');
            params.push(filter.serverCatalogId);
        }
        if (pagination.cursor) {
            conditions.push(`serverId ${pagination.sort === 'asc' ? '>' : '<'} ?`);
            params.push(pagination.cursor);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const orderClause = `ORDER BY serverId ${pagination.sort}`;
        const limitClause = `LIMIT ?`;

        const queryParams = [
            ...params,
            pagination.limit
        ];

        const servers = await this.db.query<ServerRow>(
            `SELECT * FROM servers ${whereClause} ${orderClause} ${limitClause}`,
            queryParams
        );

        // Deserialize JSON fields and hydrate catalog data
        const deserializedServers = await Promise.all(
            servers.rows.map(server => this.hydrateCatalogData(server))
        );

        const total = await this.db.query<{ count: number }>(
            `SELECT COUNT(*) as count FROM servers ${whereClause}`,
            params
        );

        const lastServer = deserializedServers[deserializedServers.length - 1];
        const hasMore = deserializedServers.length === pagination.limit;
        const nextCursor = hasMore ? lastServer.serverId : null;

        return {
            servers: deserializedServers,
            pagination: {
                total: total.rows[0].count,
                remaining: total.rows[0].count - deserializedServers.length,
                hasMore,
                nextCursor,
                limit: pagination.limit,
                sort: pagination.sort
            }
        };
    }

    async create(data: Omit<ServerData, 'serverId' | 'token' | 'createdAt' | 'updatedAt'> & { token?: string }): Promise<ServerData> {
        if (data.security === 'wrapped' && data.config) {
            data.config = await this.validateVolumeMounts(data.config);
        }

        const token = data.token ?? generateBase32Id();
        await this.db.execute(
            `INSERT INTO servers (token, name, description, config, enabled, security, serverCatalogId, pinningInfo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                token,
                data.name,
                data.description || null,
                JSON.stringify(data.config),
                data.enabled,
                data.security || null,
                data.serverCatalogId || null,
                data.pinningInfo ? JSON.stringify(data.pinningInfo) : null
            ]
        );

        const result = await this.db.query<{ serverId: number }>('SELECT last_insert_rowid() as serverId');
        if (!result.rows[0]) {
            throw new Error('Failed to get last insert ID');
        }

        return this.findById(result.rows[0].serverId) as Promise<ServerData>;
    }

    async update(serverId: number, data: Partial<ServerData>): Promise<ServerData> {
        if (data.security === 'wrapped' && data.config) {
            data.config = await this.validateVolumeMounts(data.config);
        }

        const updates: string[] = [];
        const params: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'serverId' || key === 'createdAt' || key === 'updatedAt') return;
            if (key === 'config') {
                updates.push(`${key} = ?`);
                params.push(JSON.stringify(value));
            } else if (key === 'pinningInfo') {
                updates.push(`${key} = ?`);
                params.push(value === null ? null : JSON.stringify(value));
            } else {
                updates.push(`${key} = ?`);
                params.push(value === undefined ? null : value);
            }
        });

        if (updates.length === 0) {
            return this.findById(serverId) as Promise<ServerData>;
        }

        await this.db.execute(
            `UPDATE servers SET ${updates.join(', ')} WHERE serverId = ?`,
            [...params, serverId]
        );

        return this.findById(serverId) as Promise<ServerData>;
    }

    async delete(serverId: number): Promise<void> {
        await this.db.execute('DELETE FROM servers WHERE serverId = ?', [serverId]);
    }

    async getByIds(serverIds: number[]): Promise<ServerData[]> {
        if (serverIds.length === 0) return [];
        
        const placeholders = serverIds.map(() => '?').join(',');
        const result = await this.db.query<ServerRow>(
            `SELECT * FROM servers WHERE serverId IN (${placeholders}) ORDER BY name`,
            serverIds
        );

        return Promise.all(result.rows.map(server => this.hydrateCatalogData(server)));
    }
} 