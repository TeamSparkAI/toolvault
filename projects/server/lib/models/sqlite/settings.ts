import { DatabaseClient } from './database';

interface SettingsRow {
    settingsId: number;
    category: string;
    config: string;  // Stored as JSON string in DB
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SettingsData {
    settingsId: number;
    category: string;
    config: Record<string, any>;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export class SettingsModel {
    constructor(private db: DatabaseClient) {}

    async findByCategory(category: string): Promise<SettingsData | null> {
        const result = await this.db.query<SettingsRow>(
            'SELECT * FROM settings WHERE category = ?',
            [category]
        );
        if (!result.rows[0]) {
            return null;
        }
        const row = result.rows[0];
        return {
            ...row,
            config: JSON.parse(row.config)
        };
    }

    async create(data: Omit<SettingsData, 'settingsId' | 'createdAt' | 'updatedAt'>): Promise<SettingsData> {
        await this.db.execute(
            `INSERT INTO settings (category, config, description)
             VALUES (?, ?, ?)`,
            [
                data.category,
                JSON.stringify(data.config),
                data.description || null
            ]
        );

        const result = await this.db.query<{ settingsId: number }>('SELECT last_insert_rowid() as settingsId');
        if (!result.rows[0]) {
            throw new Error('Failed to get last insert ID');
        }

        return this.findByCategory(data.category) as Promise<SettingsData>;
    }

    async update(category: string, data: Partial<Omit<SettingsData, 'settingsId' | 'createdAt' | 'updatedAt'>>): Promise<SettingsData> {
        const updates: string[] = [];
        const params: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'config') {
                updates.push(`${key} = ?`);
                params.push(JSON.stringify(value));
            } else {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        });

        if (updates.length === 0) {
            return this.findByCategory(category) as Promise<SettingsData>;
        }

        await this.db.execute(
            `UPDATE settings SET ${updates.join(', ')} WHERE category = ?`,
            [...params, category]
        );

        return this.findByCategory(category) as Promise<SettingsData>;
    }

    async delete(category: string): Promise<void> {
        await this.db.execute('DELETE FROM settings WHERE category = ?', [category]);
    }

    async list(): Promise<SettingsData[]> {
        const result = await this.db.query<SettingsData>('SELECT * FROM settings ORDER BY category');
        return result.rows;
    }
} 