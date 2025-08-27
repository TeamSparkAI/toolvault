import { DatabaseClient } from './database';
import { generateBase32Id } from '../../utils/id';
import { ClientModel } from '../client';
import { ClientData } from '../types/client';

// !!! Do we want to typecheck the client type on read?

export class SqliteClientModel extends ClientModel {
    constructor(private db: DatabaseClient) {
        super();
    }

    async findById(clientId: number): Promise<ClientData | null> {
        const result = await this.db.query<ClientData>(
            'SELECT * FROM clients WHERE clientId = ?',
            [clientId]
        );
        return result.rows[0] || null;
    }

    async findByToken(token: string): Promise<ClientData | null> {
        const result = await this.db.query<ClientData>(
            'SELECT * FROM clients WHERE token = ?',
            [token]
        );
        return result.rows[0] || null;
    }

    async create(data: Omit<ClientData, 'clientId' | 'token' | 'createdAt' | 'updatedAt'> & { token?: string }): Promise<ClientData> {
        if (data.type === 'ttv') {
            throw new Error('Cannot create another ToolVault (ttv) client. This client is created by migration and must be unique.');
        }
        const token = data.token || generateBase32Id();
        const scope = data.scope || 'project';
        
        await this.db.execute(
            `INSERT INTO clients (
                token, type, scope, name, description, configPath,
                autoUpdate, enabled, lastUpdated, lastScanned
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                token,
                data.type,
                scope,
                data.name,
                data.description || null,
                data.configPath || null,
                data.autoUpdate ? 1 : 0,
                data.enabled ? 1 : 0,
                data.lastUpdated || null,
                data.lastScanned || null
            ]
        );

        const result = await this.db.query<{ clientId: number }>('SELECT last_insert_rowid() as clientId');
        if (!result.rows[0]) {
            throw new Error('Failed to get last insert ID');
        }

        return this.findById(result.rows[0].clientId) as Promise<ClientData>;
    }

    async update(clientId: number, data: Partial<Omit<ClientData, 'clientId' | 'token' | 'createdAt' | 'updatedAt'>>): Promise<ClientData> {
        const updates: string[] = [];
        const params: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'autoUpdate' || key === 'enabled') {
                updates.push(`${key} = ?`);
                params.push(value ? 1 : 0);
            } else {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        });

        if (updates.length === 0) {
            return this.findById(clientId) as Promise<ClientData>;
        }

        await this.db.execute(
            `UPDATE clients SET ${updates.join(', ')} WHERE clientId = ?`,
            [...params, clientId]
        );

        return this.findById(clientId) as Promise<ClientData>;
    }

    async delete(clientId: number): Promise<boolean> {
        if (clientId === 1) {
            throw new Error('Cannot delete the internal ToolVault (ttv) client.');
        }
        const result = await this.db.execute('DELETE FROM clients WHERE clientId = ?', [clientId]);
        return result.changes > 0;
    }

    async list(): Promise<ClientData[]> {
        const result = await this.db.query<ClientData>(
            'SELECT * FROM clients ORDER BY name'
        );

        return result.rows;
    }

    async getByIds(clientIds: number[]): Promise<ClientData[]> {
        if (clientIds.length === 0) return [];
        
        const placeholders = clientIds.map(() => '?').join(',');
        const result = await this.db.query<ClientData>(
            `SELECT * FROM clients WHERE clientId IN (${placeholders}) ORDER BY name`,
            clientIds
        );

        return result.rows;
    }

    async updateLastUpdated(clientId: number): Promise<ClientData> {
        const now = new Date().toISOString();
        await this.db.execute(
            'UPDATE clients SET lastUpdated = ? WHERE clientId = ?',
            [now, clientId]
        );
        return this.findById(clientId) as Promise<ClientData>;
    }

    async updateLastScanned(clientId: number): Promise<ClientData> {
        const now = new Date().toISOString();
        await this.db.execute(
            'UPDATE clients SET lastScanned = ? WHERE clientId = ?',
            [now, clientId]
        );
        return this.findById(clientId) as Promise<ClientData>;
    }
} 