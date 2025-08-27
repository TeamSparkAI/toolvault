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
        const result = await this.db.query<PolicyData & { filters: string; methods: string }>(
            'SELECT * FROM policies WHERE policyId = ?',
            [policyId]
        );
        if (!result.rows[0]) return null;

        // Deserialize JSON fields
        const policy = result.rows[0];
        return {
            ...policy,
            filters: JSON.parse(policy.filters),
            methods: policy.methods ? JSON.parse(policy.methods) : undefined
        };
    }

    async list(): Promise<PolicyData[]> {
        const result = await this.db.query<PolicyData & { filters: string; methods: string }>(
            'SELECT * FROM policies ORDER BY name'
        );

        // Deserialize JSON fields
        return result.rows.map(policy => ({
            ...policy,
            filters: JSON.parse(policy.filters),
            methods: policy.methods ? JSON.parse(policy.methods) : undefined
        }));
    }

    async getByIds(policyIds: number[]): Promise<PolicyData[]> {
        if (policyIds.length === 0) return [];
        
        const placeholders = policyIds.map(() => '?').join(',');
        const result = await this.db.query<PolicyData & { filters: string; methods: string }>(
            `SELECT * FROM policies WHERE policyId IN (${placeholders}) ORDER BY name`,
            policyIds
        );

        return result.rows.map(policy => ({
            ...policy,
            filters: JSON.parse(policy.filters),
            methods: policy.methods ? JSON.parse(policy.methods) : undefined
        }));
    }

    async create(data: Omit<PolicyData, 'policyId' | 'createdAt' | 'updatedAt'>): Promise<PolicyData> {
        await this.db.execute(
            `INSERT INTO policies (
                name, description, severity, origin, methods, filters,
                action, actionText, enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.name,
                data.description || null,
                data.severity,
                data.origin,
                data.methods ? JSON.stringify(data.methods) : null,
                JSON.stringify(data.filters),
                data.action,
                data.actionText || null,
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
            if (key === 'filters') {
                updates.push(`${key} = ?`);
                params.push(JSON.stringify(value));
            } else if (key === 'methods') {
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