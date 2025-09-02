import { DatabaseClient } from './database';
import { PolicyModel } from '../policy';
import { PolicyData } from '../types/policy';

export class SqlitePolicyModel extends PolicyModel {
    private db: DatabaseClient;

    constructor(db: DatabaseClient) {
        super();
        this.db = db;
    }

    async findById(policyId: number): Promise<PolicyData | null> {
        const result = await this.db.query<PolicyData & { methods: string; conditions: string; actions: string }>(
            'SELECT * FROM policies WHERE policyId = ?',
            [policyId]
        );
        if (!result.rows[0]) return null;

        // Deserialize JSON fields
        const policy = result.rows[0];
        return {
            ...policy,
            methods: policy.methods ? JSON.parse(policy.methods) : undefined,
            conditions: policy.conditions ? JSON.parse(policy.conditions) : [],
            actions: policy.actions ? JSON.parse(policy.actions) : []
        };
    }

    async list(): Promise<PolicyData[]> {
        const result = await this.db.query<PolicyData & { methods: string; conditions: string; actions: string }>(
            'SELECT * FROM policies ORDER BY name'
        );

        // Deserialize JSON fields
        return result.rows.map(policy => ({
            ...policy,
            methods: policy.methods ? JSON.parse(policy.methods) : undefined,
            conditions: policy.conditions ? JSON.parse(policy.conditions) : [],
            actions: policy.actions ? JSON.parse(policy.actions) : []
        }));
    }

    async getByIds(policyIds: number[]): Promise<PolicyData[]> {
        if (policyIds.length === 0) return [];
        
        const placeholders = policyIds.map(() => '?').join(',');
        const result = await this.db.query<PolicyData & { methods: string; conditions: string; actions: string }>(
            `SELECT * FROM policies WHERE policyId IN (${placeholders}) ORDER BY name`,
            policyIds
        );

        return result.rows.map(policy => ({
            ...policy,
            methods: policy.methods ? JSON.parse(policy.methods) : undefined,
            conditions: policy.conditions ? JSON.parse(policy.conditions) : [],
            actions: policy.actions ? JSON.parse(policy.actions) : []
        }));
    }

    async create(data: Omit<PolicyData, 'policyId' | 'createdAt' | 'updatedAt'>): Promise<PolicyData> {
        await this.db.execute(
            `INSERT INTO policies (
                name, description, severity, origin, methods, conditions, actions, enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.name,
                data.description || null,
                data.severity,
                data.origin,
                data.methods ? JSON.stringify(data.methods) : null,
                data.conditions ? JSON.stringify(data.conditions) : null,
                data.actions ? JSON.stringify(data.actions) : null,
                data.enabled ? 1 : 0
            ]
        );

        const result = await this.db.query<{ policyId: number }>('SELECT last_insert_rowid() as policyId');
        if (!result.rows[0]) {
            throw new Error('Failed to get last insert ID');
        }

        return this.findById(result.rows[0].policyId) as Promise<PolicyData>;
    }

    async update(policyId: number, data: Partial<PolicyData>): Promise<PolicyData> {
        const updates: string[] = [];
        const params: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'policyId' || key === 'createdAt' || key === 'updatedAt') return;
            if (key === 'methods') {
                updates.push(`${key} = ?`);
                params.push(value ? JSON.stringify(value) : null);
            } else if (key === 'conditions') {
                updates.push(`${key} = ?`);
                params.push(value ? JSON.stringify(value) : null);
            } else if (key === 'actions') {
                updates.push(`${key} = ?`);
                params.push(value ? JSON.stringify(value) : null);
            } else if (key === 'enabled') {
                updates.push(`${key} = ?`);
                params.push(value ? 1 : 0);
            } else {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        });

        if (updates.length === 0) {
            return this.findById(policyId) as Promise<PolicyData>;
        }

        await this.db.execute(
            `UPDATE policies SET ${updates.join(', ')} WHERE policyId = ?`,
            [...params, policyId]
        );

        return this.findById(policyId) as Promise<PolicyData>;
    }

    async delete(policyId: number): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM policies WHERE policyId = ?', [policyId]);
        return result.changes > 0;
    }
} 