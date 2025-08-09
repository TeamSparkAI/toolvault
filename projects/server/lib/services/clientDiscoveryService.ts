import { fdir } from 'fdir';
import path from 'path';
import os from 'os';
import { ModelFactory } from '../models';
import { ClientType, ClientTypeConfig, clientTypes } from '@/lib/types/clientType';
import { ClientScope, ClientData } from '@/lib/models/types/client';
import { scanConfigFile } from './clientSyncService';
import { directoryExists, fileExists } from '../utils/fs';
import { logger } from '@/lib/logging/server';

export interface DiscoveredClient {
    clientType: ClientType;
    isGlobal: boolean;
    name: string;
    configPath: string;
    description?: string;
    hasMcpConfig: boolean;
    serverCount: number;
    isActual: boolean; // true if config file exists, false if theoretical
}

export interface ScanOptions {
    global: boolean;
    project: {
        enabled: boolean;
        mode: 'current' | 'capable';
        directory?: string;
    };
}

const excludeDirs = [
    { dirName: 'node_modules' }
];

const topLevelDirExcludesMacOs = [
    'Applications',  // installed apps
    'Desktop',       // 
    'Downloads',     // 
    'Library',       // system/app data
    'Movies',        // media files
    'Music',         // media files
    'Pictures',      // media files
    'Public'         // shared files
];

const topLevelDirExcludesWindows = [
    'AppData',       // application data
    'Contacts',      // 
    'Desktop',       // 
    'Downloads',     // 
    'Favorites',     // 
    'Links',         // 
    'Music',         // media files
    'OneDrive',      // cloud storage
    'Pictures',      // media files
    'Saved Games',   // 
    'Searches',      // 
    'Videos'         // media files
];

const topLevelDirExcludesLinux = [
    'Desktop',       // 
    'Downloads',     // 
    'Music',         // media files
    'Pictures',      // media files
    'Public',        // shared files
    'Templates',     // 
    'Videos'         // media files
];

// For optimization we want to skip directories unlikely to contain projects
function skippedDirtectories(filePath: string, dirPath: string): boolean {
    const homeDir = os.homedir();
    if (dirPath.startsWith(homeDir)) {
        const homePath = dirPath.substring(homeDir.length);
        // Use path.sep to handle platform-specific path separators automatically
        const pathSegments = homePath.split(path.sep);
        const firstPathSegment = pathSegments[1];
        if (firstPathSegment.startsWith('.')) {
            logger.debug('Skipping hidden directory:', dirPath);
            return true;
        }

        // !!! May want to add support for skipping hidden top-level directories on Windows if that turns out to be a problem
        
        // Use appropriate exclusion list based on platform
        let exclusionList: string[];
        switch (process.platform) {
            case 'darwin':
                exclusionList = topLevelDirExcludesMacOs;
                break;
            case 'win32':
                exclusionList = topLevelDirExcludesWindows;
                break;
            default: // linux and other unix-like systems
                exclusionList = topLevelDirExcludesLinux;
                break;
        }
        
        if (exclusionList.includes(firstPathSegment)) {
            logger.debug('Skipping excluded directory:', dirPath);
            return true;
        }
    }
    // Check if any path segment exactly matches these directory names, and if so, skip the directory
    const pathSegments = filePath.split(path.sep);
    return pathSegments.some(segment => segment === 'node_modules' || segment === '.git');
}

async function getExistingClients(): Promise<Set<string>> {
    try {
        const clientModel = await ModelFactory.getInstance().getClientModel();
        const clients = await clientModel.list();
        return new Set(clients.map(client => client.configPath).filter((path): path is string => !!path));
    } catch (error) {
        logger.error('Error getting existing clients:', error);
        return new Set();
    }
}

export async function discoverClients(options: ScanOptions): Promise<DiscoveredClient[]> {
    const discoveredClients: DiscoveredClient[] = [];
    const existingClients = await getExistingClients();

    // Global scan for system/application/user level configurations
    if (options.global) {
        const globalClients = await scanForGlobalClients();
        for (const client of globalClients) {
            if (!existingClients.has(client.configPath)) {
                discoveredClients.push(client);
            }
        }
    }

    // Project scan
    if (options.project.enabled) {
        if (options.project.mode === 'current') {
            // Scan for projects currently using tools (have MCP configs)
            const mcpClients = await scanForMcpFiles(options.project.directory);
            for (const client of mcpClients) {
                if (!existingClients.has(client.configPath)) {
                    discoveredClients.push(client);
                }
            }
        } else if (options.project.mode === 'capable') {
            // Scan for clients capable of tool use (check for known client directories)
            const capableClients = await scanForCapableClients(options.project.directory);
            for (const client of capableClients) {
                if (!existingClients.has(client.configPath)) {
                    discoveredClients.push(client);
                }
            }
        }
    }

    // Process client config files (for ones that exist) to get server config presence and count
    for (const client of discoveredClients) {
        if (client.isActual) {
            // Create a mock client object for scanConfigFile
            const mockClient: ClientData = {
                clientId: 0, // Not used for scanning
                type: client.clientType,
                scope: client.isGlobal ? 'global' : 'project',
                name: client.name,
                description: client.description || '',
                configPath: client.configPath,
                autoUpdate: false,
                enabled: true,
                lastScanned: undefined,
                lastUpdated: undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                token: 'discovery-token'
            };
            
            const scanResults = await scanConfigFile(client.configPath, mockClient);
            if (scanResults.servers) {
                client.hasMcpConfig = true;
                client.serverCount = scanResults.servers.length;
            } else {
                // No mcpServers object found in config file
                client.hasMcpConfig = false;
                client.serverCount = 0;
            }
        }
    }

    return discoveredClients;
}

async function scanForGlobalClients(): Promise<DiscoveredClient[]> {
    const globalClients: DiscoveredClient[] = [];

    for (const clientType of clientTypes) {
        if (clientType.globalDirectory) {
            if (await directoryExists(clientType.globalDirectory)) {
                // Directory exists (we can safely assume filename is set if directory was set)
                let isActual = false;

                const configPath = path.join(clientType.globalDirectory, clientType.globalFilename!);
                isActual = await fileExists(configPath);

                globalClients.push({
                    clientType: clientType.clientType,
                    isGlobal: true,
                    name: generateClientName(clientType, 'global', configPath),
                    configPath: configPath,
                    description: generateClientDescription(clientType, 'global', configPath), // Use "Global" type to generate better description for global clients
                    hasMcpConfig: false,
                    serverCount: 0,
                    isActual
                });
            }
        } else if (clientType.globalFilename) {
            // This is a global file with no global directory (assume it's a full path)
            const configPath = clientType.globalFilename;
            const isActual = await fileExists(configPath);
            if (isActual) {
                globalClients.push({
                    clientType: clientType.clientType,
                    isGlobal: true,
                    name: generateClientName(clientType, 'global', configPath),
                    configPath: configPath,
                    description: generateClientDescription(clientType, 'global', configPath),
                    hasMcpConfig: false,
                    serverCount: 0,
                    isActual: true
                });    
            }
        }
    }

    return globalClients;
}

async function scanForMcpFiles(scanDirectory?: string): Promise<DiscoveredClient[]> {
    const searchPaths = scanDirectory ? [scanDirectory] : [os.homedir()];
    const discovered: DiscoveredClient[] = [];
    // Build a set of all project config filenames to look for
    const configFilenames = Array.from(new Set(clientTypes.map(ct => ct.projectConfigFilename)));

    for (const searchPath of searchPaths) {
        try {
            const scanner = new fdir()
                .withDirs()
                .withFullPaths()
                .exclude(skippedDirtectories)
                .filter((filePath: string) => {
                    const fileName = path.basename(filePath);
                    return configFilenames.includes(fileName);
                });

            const files = await scanner.crawl(searchPath).withPromise();
            for (const filePath of files) {
                // Find the clientType for this config file
                const fileName = path.basename(filePath);
                const dirName = path.basename(path.dirname(filePath));

                // This is an actual config file - find the clientType that uses this directory and filename (will match zero or one clientType)
                let clientType = clientTypes.find(ct => ct.projectConfigFilename === fileName && (ct.projectConfigDirectory && ct.projectConfigDirectory === dirName));
                if (!clientType) {
                    // No match on directory, try without (clientType that explicitly has no directory)
                    clientType = clientTypes.find(ct => ct.projectConfigFilename === fileName && (!ct.projectConfigDirectory));
                }

                if (clientType) {
                    const client = {
                        clientType: clientType.clientType,
                        isGlobal: false,
                        name: generateClientName(clientType, 'project', filePath),
                        configPath: filePath,
                        description: generateClientDescription(clientType, 'project', filePath),
                        hasMcpConfig: true,
                        serverCount: 0,
                        isActual: true // This is an actual MCP config file
                    };
                    discovered.push(client);
                }
            }
        } catch (error) {
            logger.error(`Error scanning directory ${searchPath}:`, error);
        }
    }
    return discovered;
}

async function scanForCapableClients(scanDirectory?: string): Promise<DiscoveredClient[]> {
    const searchPaths = scanDirectory ? [scanDirectory] : [os.homedir()];
    const discovered: DiscoveredClient[] = [];
    // Build sets of all project config directories and filenames
    const configDirs = Array.from(new Set(clientTypes.map(ct => ct.projectConfigDirectory).filter(Boolean)));
    const configFilenames = Array.from(new Set(clientTypes.map(ct => ct.projectConfigFilename)));
    // Map to track theoretical entries by configPath
    const theoreticalMap = new Map<string, number>();

    for (const searchPath of searchPaths) {
        try {
            const scanner = new fdir()
                .withDirs()
                .withFullPaths()
                .exclude(skippedDirtectories)
                .filter((filePath: string, isDir: boolean) => {
                    const fileName = path.basename(filePath);
                    // Look for client directories or config files
                    return (isDir && configDirs.includes(fileName)) || (!isDir && configFilenames.includes(fileName));
                });

            const files = await scanner.crawl(searchPath).withPromise();
            for (const filePath of files) {
                const fileName = path.basename(filePath);
                if (configDirs.includes(fileName)) {
                    // This is a client directory, find the clientType that use this directory - should always match exactly one clientType for a matched directory
                    const clientType = clientTypes.find(ct => ct.projectConfigDirectory === fileName);
                    if (clientType) { 
                        // Add as theoretical (isActual: false)
                        const hypotheticalPath = path.join(filePath, clientType.projectConfigFilename);
                        const idx = discovered.length;
                        const client = {
                            clientType: clientType.clientType,
                            isGlobal: false,
                            name: generateClientName(clientType, 'project', hypotheticalPath),
                            configPath: hypotheticalPath,
                            description: generateClientDescription(clientType, 'project', hypotheticalPath),
                            hasMcpConfig: false,
                            serverCount: 0,
                            isActual: false
                        };
                        // Add the client to the discovered list and the theoreticalMap
                        discovered.push(client);
                        theoreticalMap.set(hypotheticalPath, idx);
                    }
                } else if (configFilenames.includes(fileName)) {
                    const dirName = path.basename(path.dirname(filePath));

                    // This is an actual config file - find the clientType that use this directory and filename (will match zero or one clientType)
                    let clientType = clientTypes.find(ct => ct.projectConfigFilename === fileName && (ct.projectConfigDirectory && ct.projectConfigDirectory === dirName));
                    if (!clientType) {
                        // No match on directory, try without (clientType that explicitly has no directory)
                        clientType = clientTypes.find(ct => ct.projectConfigFilename === fileName && (!ct.projectConfigDirectory));
                    }

                    if (clientType) {
                        // No guarantee of a clientType match - for example, if we have filename that only matches with a directory and it was found but not in that directory
                        const idx = theoreticalMap.get(filePath);
                        const client = {
                            clientType: clientType.clientType,
                            isGlobal: false,
                            name: generateClientName(clientType, 'project', filePath),
                            configPath: filePath,
                            description: generateClientDescription(clientType, 'project', filePath),
                            hasMcpConfig: true,
                            serverCount: 0,
                            isActual: true
                        };
                        if (idx !== undefined) {
                            // Replace the theoretical entry with the actual entry
                            discovered[idx] = client;
                        } else {
                            // Add the actual entry to the discovered list
                            discovered.push(client);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Error scanning directory ${searchPath}:`, error);
        }
    }
    return discovered;
}

function generateClientName(clientTypeConfig: ClientTypeConfig, clientScope: ClientScope, filePath: string): string {
    let projectDirectory = path.dirname(filePath);
    if (clientTypeConfig.projectConfigDirectory) {
        // If the clientTypeConfig has a projectConfigDirectory, we need to go up one more level to get the project directory
        projectDirectory = path.dirname(projectDirectory);
    }

    let parenValue = path.basename(projectDirectory);
    if (clientScope === 'global') {
        parenValue = 'Global';
    }

    switch (clientTypeConfig.clientType) {
        case 'cursor':
            return `Cursor (${parenValue})`;
        case 'vscode':
            return `VS Code (${parenValue})`;
        case 'claudecode':
            return `Claude Code (${parenValue})`;
        case 'windsurf':
            return `Windsurf (${parenValue})`;
        case 'roocode':
            return `RooCode (${parenValue})`;
        default:
            return `Generic Client (${parenValue})`;
    }
}

function generateClientDescription(clientTypeConfig: ClientTypeConfig, clientScope: ClientScope, filePath: string): string {
    const dirName = path.basename(path.dirname(filePath));
    let prefix = 'Project'
    if (clientScope === 'global') {
        prefix = 'Global';
    }

    switch (clientTypeConfig.clientType) {
        case 'cursor':
            return `${prefix} Cursor IDE MCP configuration`;
        case 'vscode':
            return `${prefix} VS Code MCP configuration`;
        case 'claudecode':
            return `${prefix} Claude Code MCP configuration`;
        case 'windsurf':
            return `${prefix} Windsurf IDE MCP configuration`;
        case 'roocode':
            return `${prefix} RooCode IDE MCP configuration`;
        default:
            return `${prefix} Generic MCP configuration`;
    }
}