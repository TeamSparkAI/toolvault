import { SettingsModel } from './sqlite/settings';
import { logger } from '@/lib/logging/server';
import { AppSettingsData } from './types/appSettings';

export abstract class AppSettingsModel {
    protected constructor(protected settings: SettingsModel) {}

    protected static readonly CATEGORY = 'app';
    protected static readonly DEFAULT_CONFIG: AppSettingsData = {
        requireClientToken: false,
        strictServerAccess: false,
        messageRetentionDays: 90,
        alertRetentionDays: 90
    };

    /**
     * Get the current app settings configuration
     */
    async get(): Promise<AppSettingsData> {
        const settings = await this.settings.findByCategory(AppSettingsModel.CATEGORY);
        if (!settings) {
            return AppSettingsModel.DEFAULT_CONFIG;
        }

        const config = settings.config;
        if (!this.isValidAppSettingsData(config)) {
            logger.error('Invalid app settings data shape:', config);
            return AppSettingsModel.DEFAULT_CONFIG;
        }

        return config;
    }

    /**
     * Set the app settings configuration
     */
    async set(config: AppSettingsData): Promise<void> {
        this.validate(config);
        const settings = await this.settings.findByCategory(AppSettingsModel.CATEGORY);
        
        if (settings) {
            await this.settings.update(AppSettingsModel.CATEGORY, {
                config,
                description: 'Application settings configuration'
            });
        } else {
            await this.settings.create({
                category: AppSettingsModel.CATEGORY,
                config,
                description: 'Application settings configuration'
            });
        }
    }

    /**
     * Validate app settings configuration
     */
    protected validate(config: AppSettingsData): void {
        if (!this.isValidAppSettingsData(config)) {
            throw new Error('Invalid app settings configuration shape');
        }
        if (typeof config.requireClientToken !== 'boolean') {
            throw new Error('requireClientToken must be a boolean');
        }
        if (typeof config.strictServerAccess !== 'boolean') {
            throw new Error('strictServerAccess must be a boolean');
        }
        if (typeof config.messageRetentionDays !== 'number' || config.messageRetentionDays < 1) {
            throw new Error('messageRetentionDays must be a positive number');
        }
        if (typeof config.alertRetentionDays !== 'number' || config.alertRetentionDays < 1) {
            throw new Error('alertRetentionDays must be a positive number');
        }
    }

    /**
     * Check if the config matches the AppSettingsData shape
     */
    private isValidAppSettingsData(config: unknown): config is AppSettingsData {
        if (!config || typeof config !== 'object') return false;
        const data = config as Record<string, unknown>;
        return (
            typeof data.requireClientToken === 'boolean' &&
            typeof data.strictServerAccess === 'boolean' &&
            typeof data.messageRetentionDays === 'number' &&
            typeof data.alertRetentionDays === 'number'
        );
    }
} 