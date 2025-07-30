import { SettingsData, SettingsModel } from './sqlite/settings';
import { HostData } from './types/host';
import { logger } from '@/lib/logging/server';

export interface HostSettingsModel {
    findByCategory(category: string): Promise<SettingsData | null>;
    create(data: Omit<SettingsData, 'settingsId' | 'createdAt' | 'updatedAt'>): Promise<SettingsData>;
    update(category: string, data: Partial<Omit<SettingsData, 'settingsId' | 'createdAt' | 'updatedAt'>>): Promise<SettingsData>;
}

export abstract class HostModel {
    protected constructor(protected settings: SettingsModel) {}

    protected static readonly CATEGORY = 'host';
    protected static readonly DEFAULT_CONFIG: HostData = {
        type: 'sse',
        port: 0
    };

    /**
     * Get the current host configuration
     */
    async get(): Promise<HostData> {
        const settings = await this.settings.findByCategory(HostModel.CATEGORY);
        if (!settings) {
            return HostModel.DEFAULT_CONFIG;
        }

        const config = settings.config;
        if (!this.isValidHostData(config)) {
            logger.error('Invalid host data shape:', config);
            return HostModel.DEFAULT_CONFIG;
        }

        return config;
    }

    /**
     * Set the host configuration
     */
    async set(config: HostData): Promise<void> {
        this.validate(config);
        const settings = await this.settings.findByCategory(HostModel.CATEGORY);
        
        if (settings) {
            await this.settings.update(HostModel.CATEGORY, {
                config,
                description: 'MCP host configuration'
            });
        } else {
            await this.settings.create({
                category: HostModel.CATEGORY,
                config,
                description: 'MCP host configuration'
            });
        }
    }

    /**
     * Validate host configuration
     */
    protected validate(config: HostData): void {
        if (!this.isValidHostData(config)) {
            throw new Error('Invalid host configuration shape');
        }
        if (!['sse', 'streamable'].includes(config.type)) {
            throw new Error(`Invalid MCP host type: ${config.type}`);
        }
        if (typeof config.port !== 'number' || config.port < 0 || config.port > 65535) {
            throw new Error('MCP host port must be a number between 0 and 65535');
        }
    }

    /**
     * Check if the config matches the HostData shape
     */
    private isValidHostData(config: unknown): config is HostData {
        if (!config || typeof config !== 'object') return false;
        const data = config as Record<string, unknown>;
        return (
            typeof data.type === 'string' &&
            ['sse', 'streamable'].includes(data.type) &&
            (data.host === undefined || typeof data.host === 'string') &&
            typeof data.port === 'number'
        );
    }
} 