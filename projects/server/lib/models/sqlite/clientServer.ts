import { DatabaseClient } from './database';
import { ClientServerModel } from '../clientServer';
import { ClientServerData, ClientServerFilter } from '../types/clientServer';

interface ClientServerRow {
    clientServerId: number;
    clientId: number;
    serverId: number | null;
    clientServerName: string | null;
    toolNames?: string;
    syncState?: string;
    createdAt: string;
    updatedAt: string;
}

export class SqliteClientServerModel extends ClientServerModel {
    constructor(private db: DatabaseClient) {
        super();
    }

    async findById(clientServerId: number): Promise<ClientServerData | null> {
        const result = await this.db.query<ClientServerRow>(
            'SELECT * FROM client_servers WHERE clientServerId = ?',
            [clientServerId]
        );
        
        if (!result.rows[0]) {
            return null;
        }

        return this.deserializeRow(result.rows[0]);
    }

    async findByClientAndServer(clientId: number, serverId: number | null): Promise<ClientServerData | null> {
        const result = await this.db.query<ClientServerRow>(
            'SELECT * FROM client_servers WHERE clientId = ? AND serverId IS ?',
            [clientId, serverId]
        );
        
        if (!result.rows[0]) {
            return null;
        }

        return this.deserializeRow(result.rows[0]);
    }

    async create(data: Omit<ClientServerData, 'clientServerId' | 'createdAt' | 'updatedAt'>): Promise<ClientServerData> {
        await this.db.execute(
            `INSERT INTO client_servers (
                clientId, serverId, clientServerName, toolNames, syncState
            ) VALUES (?, ?, ?, ?, ?)`,
            [
                data.clientId,
                data.serverId,
                data.clientServerName,
                data.toolNames ? JSON.stringify(data.toolNames) : null,
                data.syncState || null
            ]
        );

        const result = await this.db.query<{ clientServerId: number }>('SELECT last_insert_rowid() as clientServerId');
        if (!result.rows[0]) {
            throw new Error('Failed to get last insert ID');
        }

        return this.findById(result.rows[0].clientServerId) as Promise<ClientServerData>;
    }

    async update(clientServerId: number, data: Partial<Omit<ClientServerData, 'clientServerId' | 'createdAt' | 'updatedAt'>>): Promise<ClientServerData> {
        const updates: string[] = [];
        const params: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'toolNames') {
                updates.push(`${key} = ?`);
                params.push(value ? JSON.stringify(value) : null);
            } else {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        });

        if (updates.length === 0) {
            return this.findById(clientServerId) as Promise<ClientServerData>;
        }

        await this.db.execute(
            `UPDATE client_servers SET ${updates.join(', ')} WHERE clientServerId = ?`,
            [...params, clientServerId]
        );

        return this.findById(clientServerId) as Promise<ClientServerData>;
    }

    async delete(clientServerId: number): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM client_servers WHERE clientServerId = ?', [clientServerId]);
        return result.changes > 0;
    }

    async list(filter: ClientServerFilter): Promise<ClientServerData[]> {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filter.clientId !== undefined) {
            conditions.push('clientId = ?');
            params.push(filter.clientId);
        }
        if (filter.serverId !== undefined) {
            conditions.push('serverId IS ?');
            params.push(filter.serverId);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const orderClause = 'ORDER BY clientServerId ASC';

        const result = await this.db.query<ClientServerRow>(
            `SELECT * FROM client_servers ${whereClause} ${orderClause}`,
            params
        );

        return result.rows.map(row => this.deserializeRow(row));
    }

    private deserializeRow(row: ClientServerRow): ClientServerData {
        return {
            ...row,
            toolNames: row.toolNames ? JSON.parse(row.toolNames) : undefined,
            syncState: row.syncState as 'add' | 'deleteScanned' | 'deletePushed' | 'pushed' | 'scanned'  | undefined
        };
    }
} 