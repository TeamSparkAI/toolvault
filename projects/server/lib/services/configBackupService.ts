import * as fs from 'fs/promises';
import * as path from 'path';
import { getAppDataPath } from '../../../shared/utils/paths';
import { logger } from '@/lib/logging/server';
import { ClientData } from '../models/types/client';
import { fileExists } from '../utils/fs';

export interface ConfigBackup {
    originalFile: string;      // Full path to original file
    backupFile: string;        // Full path to backup file  
    timestamp: string;         // ISO timestamp of backup creation
    clientId: number;          // ID of the client that triggered backup
    clientType: string;        // Type of client (vscode, cursor, etc.)
    clientName: string;        // Name of the client
    operation: 'convert';      // Operation that triggered backup
    status: 
        'active'   |           // There is an active backup that can be reverted 
        'reverted' |           // The backup has been reverted and the backup file has been removed
        'deleted';             // Upon modification we found an "active" record, but no backup file exists, so we mark as "deleted" (so that we don't create a new backup)
    statusAt: string;
    empty?: boolean;           // Whether this backup was created empty (indicates original file did not exist)
}

export class ConfigBackupService {
    private backupsFilePath: string;

    constructor() {
        this.backupsFilePath = path.join(getAppDataPath(), 'backups.json');
    }

    private async readBackups(): Promise<ConfigBackup[]> {
        try {
            const text = await fs.readFile(this.backupsFilePath, 'utf8');
            const list = JSON.parse(text) as any[];
            return Array.isArray(list) ? (list as ConfigBackup[]) : [];
        } catch {
            return [];
        }
    }

    private async writeBackups(backups: ConfigBackup[]): Promise<void> {
        // Ensure app data directory exists before writing
        const appDataPath = getAppDataPath();
        await fs.mkdir(appDataPath, { recursive: true });
        await fs.writeFile(this.backupsFilePath, JSON.stringify(backups, null, 2));
    }

    private findIndex(backups: ConfigBackup[], originalFilePath: string): number {
        return backups.findIndex(b => b.originalFile === originalFilePath);
    }

    /** Internal shared backup creation */
    private async createBackupInternal(
        originalFilePath: string,
        client: ClientData,
        emptyBackup: boolean
    ): Promise<ConfigBackup | null> {
        try {
            const now = new Date().toISOString();
            const backupFilePath = `${originalFilePath}.tbk`;

            const backups = await this.readBackups();
            const existingIdx = this.findIndex(backups, originalFilePath);
            if (existingIdx >= 0) {
                const existing = backups[existingIdx];
                if (existing.status === 'reverted') {
                    // ok, we'll replace below
                } else if (existing.status === 'active') {
                    if (await fileExists(existing.backupFile)) {
                        logger.debug(`[ConfigBackupService] Active backup already exists: ${existing.backupFile}`);
                        return null;
                    } else {
                        existing.status = 'deleted';
                        existing.statusAt = now;
                        await this.writeBackups(backups);
                        logger.warn(`[ConfigBackupService] Active backup missing on disk. Marked deleted: ${existing.backupFile}`);
                        return null;
                    }
                } else if (existing.status === 'deleted') {
                    logger.debug(`[ConfigBackupService] Previous backup marked deleted; not creating new backup for ${originalFilePath}`);
                    return null;
                }
            }

            if (emptyBackup) {
                await fs.writeFile(backupFilePath, '');
            } else {
                // Ensure original exists and is a file
                const originalStats = await fs.stat(originalFilePath);
                if (!originalStats.isFile()) {
                    logger.warn(`[ConfigBackupService] Original file is not a regular file: ${originalFilePath}`);
                    return null;
                }
                await fs.copyFile(originalFilePath, backupFilePath);
                // Validate sizes match
                const backupStats = await fs.stat(backupFilePath);
                if (backupStats.size !== originalStats.size) {
                    logger.error(`[ConfigBackupService] Backup validation failed: size mismatch. Original: ${originalStats.size}, Backup: ${backupStats.size}`);
                    try { await fs.unlink(backupFilePath); } catch {}
                    return null;
                }
            }

            const backup: ConfigBackup = {
                originalFile: originalFilePath,
                backupFile: backupFilePath,
                timestamp: now,
                clientId: client.clientId,
                clientType: client.type,
                clientName: client.name,
                operation: 'convert',
                status: 'active',
                statusAt: now,
                empty: emptyBackup ? true : undefined
            } as ConfigBackup;

            if (existingIdx >= 0) {
                backups[existingIdx] = backup;
            } else {
                backups.push(backup);
            }
            await this.writeBackups(backups);
            logger.debug(`[ConfigBackupService] Created ${emptyBackup ? 'empty ' : ''}backup: ${backupFilePath}`);
            return backup;
        } catch (error) {
            logger.error(`[ConfigBackupService] Failed to create ${emptyBackup ? 'empty ' : ''}backup for ${originalFilePath}: ${error}`);
            return null;
        }
    }

    /**
     * Create a backup of the specified file
     * @param originalFilePath Full path to the original file (that will be created)
     * @param client Client data object
     * @returns Backup metadata if created, null if backup already exists
     */
    async createBackup(
        originalFilePath: string,
        client: ClientData
    ): Promise<ConfigBackup | null> {
        return this.createBackupInternal(originalFilePath, client, false);
    }

    /**
     * Create an empty backup file to indicate the original file did not exist
     * @param originalFilePath Full path to the original file (that will be created)
     * @param client Client data object
     * @returns Backup metadata if created, null if backup already exists
     */
    async createEmptyBackup(
        originalFilePath: string,
        client: ClientData
    ): Promise<ConfigBackup | null> {
        return this.createBackupInternal(originalFilePath, client, true);
    }

    /**
     * Get all recorded backups
     * @returns Array of all backup records
     */
    async getAllBackups(): Promise<ConfigBackup[]> {
        return this.readBackups();
    }

    /**
     * Revert a specific backup
     * @param originalFilePath Path to the original file
     * @returns True if revert was successful, false otherwise
     */
    async revertBackup(originalFilePath: string): Promise<boolean> {
        try {
            const backupFilePath = `${originalFilePath}.tbk`;
            
            // Determine if backup is empty (signals original file did not exist)
            const stats = await fs.stat(backupFilePath);
            if (stats.size === 0) {
                // Empty backup indicates original file did not exist; remove if present
                const originalExists = await fileExists(originalFilePath);
                if (originalExists) {
                    try {
                        await fs.unlink(originalFilePath);
                    } catch (unlinkError) {
                        logger.error(`[ConfigBackupService] Failed to remove existing original file during empty-backup revert: ${unlinkError}`);
                        return false;
                    }
                }
            } else {
                // Restore from backup
                await fs.copyFile(backupFilePath, originalFilePath);
            }

            // Remove the backup file since it's no longer needed
            await fs.unlink(backupFilePath);
            
            // Update status for latest record for this originalFile
            const backups = await this.readBackups();
            const idx = this.findIndex(backups, originalFilePath);
            if (idx >= 0) {
                backups[idx].status = 'reverted';
                backups[idx].statusAt = new Date().toISOString();
                await this.writeBackups(backups);
            }
            
            logger.debug(`[ConfigBackupService] Successfully reverted and cleaned up: ${originalFilePath}`);
            return true;
            
        } catch (error) {
            logger.error(`[ConfigBackupService] Failed to revert backup for ${originalFilePath}: ${error}`);
            return false;
        }
    }

    /**
     * Revert all active backups
     * @returns Array of results for each backup attempt
     */
    async revertAllActiveBackups(): Promise<{ originalFile: string; success: boolean; action?: 'removed' | 'restored'; error?: string }[]> {
        const backups = await this.readBackups();
        const results: { originalFile: string; success: boolean; action?: 'removed' | 'restored'; error?: string }[] = [];

        for (const backup of backups) {
            if (backup.status !== 'active') continue;
            
            // Check if backup file exists before attempting revert
            const backupExists = await fileExists(backup.backupFile);
            if (!backupExists) {
                // Mark as deleted since backup file is missing
                backup.status = 'deleted';
                backup.statusAt = new Date().toISOString();
                await this.writeBackups(backups);
                logger.debug(`[ConfigBackupService] Marked backup as deleted due to missing file: ${backup.originalFile}`);
                continue; // Skip this backup, don't add to results
            }
            
            try {
                // Determine intended action from backup metadata or file size
                let action: 'removed' | 'restored' = 'restored';
                if (backup.empty === true) {
                    action = 'removed';
                } else {
                    try {
                        const st = await fs.stat(backup.backupFile);
                        action = st.size === 0 ? 'removed' : 'restored';
                    } catch {
                        // ignore, keep default
                    }
                }

                const success = await this.revertBackup(backup.originalFile);
                results.push({
                    originalFile: backup.originalFile,
                    success,
                    action: success ? action : undefined,
                    error: success ? undefined : 'Revert failed'
                });
            } catch (error) {
                results.push({
                    originalFile: backup.originalFile,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return results;
    }
}