import { ModelFactory } from '../models';
import { ClientData } from '@/lib/models/types/client';
import { ClientServerData } from '@/lib/models/types/clientServer';
import { McpServerConfig, McpServerConfigType, ServerSecurity } from '@/lib/types/server';
import { ServerData } from '@/lib/models/types/server';
import { McpConfigFileService } from './mcpConfigFileService';
import { ConfigBackup } from './configBackupService';
import { ClientType, getClientTypeConfig } from '@/lib/types/clientType';
import { ClientScope } from '@/lib/models/types/client';
import { isSecurityWrappable, wrapSecurity, unwrapSecurity } from '../utils/security';
import { logger } from '../logging/server';
import path from 'path';

export interface ServerScanResult {
    serverName: string;
    config: McpServerConfig;
    isManaged: boolean;
    serverToken?: string;
    clientToken?: string;
}

export interface ImportResult {
    serverId: number;
    serverName: string;
}

export interface ConvertResult {
    clientId: number;
    clientServerName: string;
    managedServer: {
        serverId: number;
        isNew: boolean;
    }
}

export interface UpdateResults {
    mcpServersUpdated: boolean;
    updates: {
        clientServerName: string;
        serverName: string;
    }[];
}

export interface SyncOptions {
    configPath?: string;
    scan?: boolean;
    import?: boolean;
    convert?: boolean;
    convertWrapping?: boolean;
    update?: boolean;
    serverIds?: (number | null)[];
    createBackups?: boolean; // Whether to create backups when modifying config files (defaults to true)
}

export interface SyncResponse {
    clientId: number;
    syncOptions: SyncOptions;
    scanResults?: { servers: ServerScanResult[] };
    importResults?: { servers: ImportResult[] };
    convertResults?: ConvertResult[];
    updateResults?: UpdateResults;
    backupResults?: ConfigBackup[]; // Internal use only - not exposed to UX
}

function getManagedServerConfig(client: ClientData, server: ServerData): McpServerConfig {
    return {
        type: "stdio",
        command: "tsh",
        args: [server.name + "/" + server.token, client.token]
    };
}

// Server token is the second part of the first argument to tsh (after optional server name, separated by a slash)
function getManagedServerServerToken(config: McpServerConfig): string | null {
    if (config.type === "stdio" && config.command === "tsh" && config.args && config.args.length > 0) {
        const parts = config.args[0].split("/");
        if (parts.length > 1) {
            return parts[1];
        } else {
            return parts[0];
        }
    }
    return null;
}

// Client token is the second argument to tsh
function getManagedServerClientToken(config: McpServerConfig): string | null {
    if (config.type === "stdio" && config.command === "tsh" && config.args && config.args.length > 1) {
        return config.args[1];
    }
    return null;
}

// Helper function to compute projectPath from configPath and clientType
function computeProjectPath(configPath: string, clientType: ClientType): string {
    let projectPath = path.dirname(configPath);
    
    // Get the client type config to check for projectConfigDirectory
    const clientTypeConfig = getClientTypeConfig(clientType);
    
    // If the clientType has a projectConfigDirectory, we need to go up one more level
    if (clientTypeConfig.projectConfigDirectory) {
        projectPath = path.dirname(projectPath);
    }
    
    return projectPath;
}

// Helper function to set default cwd for stdio servers under certain conditions
function setDefaultCwd(config: McpServerConfig, client: ClientData): McpServerConfig {
    // Only proceed if this is a stdio server
    if (config.type !== 'stdio') {
        return config;
    }
    
    // Only proceed if cwd is not already set
    if (config.cwd) {
        return config;
    }
    
    // Only proceed if command is not npx or uvx
    if (config.command === 'npx' || config.command === 'uvx') {
        return config;
    }
    
    // Only proceed if this is not a global client
    if (client.scope === 'global') {
        return config;
    }
    
    // Only proceed if configPath is defined
    if (!client.configPath) {
        return config;
    }
    
    // Compute the project path and set it as cwd
    const projectPath = computeProjectPath(client.configPath, client.type);
    
    return {
        ...config,
        cwd: projectPath
    };
}

// Compare two objects for deep equality (ignoring order of keys)
//
export function deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;

    if (obj1 == null || obj2 == null) return obj1 === obj2;

    if (typeof obj1 !== typeof obj2) return false;

    if (typeof obj1 !== 'object') return obj1 === obj2;

    if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

    if (Array.isArray(obj1)) {
        if (obj1.length !== obj2.length) return false;
        for (let i = 0; i < obj1.length; i++) {
            if (!deepEqual(obj1[i], obj2[i])) return false;
        }
        return true;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    // Sort keys for consistent comparison
    keys1.sort();
    keys2.sort();

    for (let i = 0; i < keys1.length; i++) {
        if (keys1[i] !== keys2[i]) return false;
        if (!deepEqual(obj1[keys1[i]], obj2[keys2[i]])) return false;
    }

    return true;
}

// Validate the config is a valid McpServerConfig, and create a new McpServerConfig object that only contains the valid properties from the original config
//
function validateMcpConfig(config: any): McpServerConfig {
    const type: McpServerConfigType | undefined = config.type ?? config.command ? 'stdio' : config.url ? 'sse' : undefined;
    if (!type) {
        throw new Error('Invalid MCP server config, no type and no command:' + JSON.stringify(config));
    } else if (type === 'stdio') {
        if (!config.command) {
            throw new Error('Invalid MCP server config, stdio type with no command: ' + JSON.stringify(config));
        }
    } else if (type === 'sse' || type === 'streamable') {
        if (!config.url) {
            throw new Error('Invalid MCP server config, ' + type + ' type with no url: ' + JSON.stringify(config));
        }
    }

    if (type === 'stdio') {
        return {
            type: type,
            command: config.command,
            ...(config.args && { args: config.args }),
            ...(config.env && { env: config.env }),
            ...(config.cwd && { cwd: config.cwd }),
        } as McpServerConfig;
    } else if (type === 'sse' || type === 'streamable') {
        return {
            type: type,
            url: config.url,
            ...(config.headers && { headers: config.headers }),
        } as McpServerConfig;
    }
    throw new Error('Invalid MCP server config, invalid type: ' + JSON.stringify(config));
}

async function getMcpFileConfigService(
    configPath: string, 
    client: ClientData,
    backupEnabled: boolean = true
): Promise<McpConfigFileService> {
    const clientTypeConfig = getClientTypeConfig(client.type);
    return new McpConfigFileService({
        filePath: configPath,
        fileMustExist: false,
        mcpConfig: client.scope === "global" ? clientTypeConfig.globalFileMcpKey : undefined,
        mcpServers: clientTypeConfig.mcpServersKey,
        backupEnabled,
        backupClient: backupEnabled ? client : undefined
    });
}

// This is a helper function to scan a config file and return the servers found in it (used by discovery)
//
// This is only called by discovery on files that we've actually found, so we don't need to handle the case where the file doesn't exist
//
export async function scanConfigFile(configPath: string, client: ClientData): Promise<{ servers: ServerScanResult[] | null }> {
    const configService = await getMcpFileConfigService(configPath, client);

    // Load the config file
    try {
        await configService.load();
    } catch (error) {
        throw new Error('Config file does not exist or is invalid: ' + configPath);
    }

    // Get MCP servers
    const mcpServers = configService.getMcpServers();
    if (!mcpServers) {
        // No MCP servers found in config file
        return { servers: null };
    }

    return performScan(mcpServers);
}

export async function syncClient(client: ClientData, options: SyncOptions): Promise<SyncResponse> {
    const configPath = options.configPath || client.configPath;
    if (!configPath) {
        throw new Error('Config path is required');
    }

    logger.debug('[syncClient] configPath:', configPath);

    const backupEnabled = options.createBackups ?? true;
    const configService = await getMcpFileConfigService(
        configPath, 
        client,
        backupEnabled
    );

    // Load the config file
    try {
        await configService.load();
    } catch (error) {
        throw new Error('Config file does not exist or is invalid: ' + configPath);
    }

    // Get MCP servers (not required to exist)
    const mcpServers = configService.getMcpServers() ?? {};

    const response: SyncResponse = {
        clientId: client.clientId,
        syncOptions: options
    };

    // Scan first to get baseline of what's in the client config
    if (options.scan) {
        response.scanResults = await performScan(mcpServers);
    }

    // Import servers found during scan
    if (options.import && response.scanResults) {
        if (response.scanResults.servers.length > 0) {
            response.importResults = await performImport(client, options, response.scanResults.servers);
        }
        // Update lastScanned timestamp after import
        const clientModel = await ModelFactory.getInstance().getClientModel();
        await clientModel.updateLastScanned(client.clientId);
    }

    // Convert existing unmanaged servers to managed
    if (options.convert) {
        response.convertResults = await performConvert(client, options);
    }

    // Update client config to use managed servers
    if (options.update) {
        response.updateResults = await performUpdate(client, options, configService);
        if (response.updateResults.mcpServersUpdated) {
            // Save the config file with all changes
            try {
                await configService.save();
                logger.debug('[syncClient] mcpServers updated and written to config file:', JSON.stringify(mcpServers, null, 2));
                // Update lastUpdated timestamp after successful update
                const clientModel = await ModelFactory.getInstance().getClientModel();
                await clientModel.updateLastUpdated(client.clientId);
            } catch (error) {
                logger.error('[syncClient] Error writing mcpServers to config file:', error);
                throw new Error('Error writing mcpServers to config file: ' + error);
            }
        }
    }

    // Collect backup results (internal use only)
    const backupCreated = configService.getBackupCreated();
    if (backupCreated) {
        response.backupResults = [backupCreated];
        logger.debug('[syncClient] Backup created:', backupCreated);
    }

    logger.debug('[syncClient] response:', JSON.stringify(response, null, 2));

    return response;
}

export async function performScan(mcpServers: any): Promise<{ servers: ServerScanResult[] }> {
    // Iterate MCP servers
    const servers: ServerScanResult[] = [];
    for (const server of Object.keys(mcpServers)) {
        // Only process supported types (this covers skipping TeamSpark Workbench "internal" tools)
        if (['stdio', 'sse', 'streamable'].includes(mcpServers[server].type) || mcpServers[server].command) {
            const config = validateMcpConfig(mcpServers[server]);
            const serverToken = getManagedServerServerToken(config);
            servers.push({
                serverName: server,
                config: config,
                isManaged: serverToken !== null,
                serverToken: serverToken ?? undefined,
                clientToken: getManagedServerClientToken(config) ?? undefined
            });
        }
    }

    logger.debug('[performScan] servers:', servers);

    return {
        servers: servers
    };
}

export async function performImport(client: ClientData, options: SyncOptions, scannedServers?: ServerScanResult[]): Promise<{ servers: ImportResult[] }> {
    const clientServerModel = await ModelFactory.getInstance().getClientServerModel();
    const serverModel = await ModelFactory.getInstance().getServerModel();

    const clientServerRelations = await clientServerModel.list({ clientId: client.clientId });
    function removeProcessedRelation(relations: ClientServerData[], predicate: (relation: ClientServerData) => boolean) {
        const index = relations.findIndex(predicate);
        if (index !== -1) {
            relations.splice(index, 1);
            return true; // removed
        }
        return false; // not found
    }

    // Compare scanned server to model server (generally from a relation)
    function areServersEqual(scannedServer: ServerScanResult, relationServer: ServerData): boolean {
        if (scannedServer.isManaged === (relationServer.security !== "unmanaged")) {
            if (scannedServer.isManaged) {
                if (scannedServer.serverToken === relationServer.token) {
                    return true;
                }
            } else { // unmanaged
                if (deepEqual(scannedServer.config, relationServer.config)) {
                    return true;
                }
            }
        }
        return false;
    }

    const servers = await serverModel.getByIds(clientServerRelations.map(relation => relation.serverId).filter((id): id is number => id !== null));
    const serverMap = new Map(servers.map(server => [server.serverId, server]));

    // Take the results of performScan and sync them to the client
    // - As we process items, we'll remove them from the clientServerRelations list (so at the end we can process what's left)
    for (const scannedServer of scannedServers ?? []) {
        let clientServerRelation = clientServerRelations.find(relation => relation.clientServerName === scannedServer.serverName);
        if (clientServerRelation && clientServerRelation.serverId === null) {
            logger.debug('[performImport] Deleting pending delete relation at clientServerName:', scannedServer.serverName);
            // The client config has a server at this clientServerName, and we have deleted a server at this clientServerName (but we
            // have no other details about the server we deleted).  We will delete this pending delete relation at this clientServerName
            // and continue, which will process the config as if it was a new server (which is what we want).  If it happens to refer
            // to the deleted server, it will be handled (ignored) below as an obsolute managed server reference.
            const deleted = await clientServerModel.delete(clientServerRelation.clientServerId);
            if (!deleted) {
                logger.warn(`[performImport] Failed to delete client-server relation ${clientServerRelation.clientServerId}`);
            }
            removeProcessedRelation(clientServerRelations, relation => relation.clientServerId === clientServerRelation!.clientServerId);
            clientServerRelation = undefined;
        }
        if (clientServerRelation) {
            // There is an existing relation between this client and a server synced to the scanned clients clientServerName
            if (!clientServerRelation.serverId) {
                // The client config has a server at this clientServerName, and we have deleted a server at this clientServerName (but we
                // have no other details about the server we deleted)

                logger.debug('[performImport] Skipping relation with null serverId');
                continue;
            }
            const server = serverMap.get(clientServerRelation.serverId)!;
            if (areServersEqual(scannedServer, server)) {
                if (clientServerRelation.syncState === "add" || clientServerRelation.syncState === "deleteScanned" || clientServerRelation.syncState === "deletePushed") {
                    // If "add", we have a pending update that matches a server we found on the client
                    // If "delete", we have a pending delete for a server we found on the client (removing it seems odd, but it's consistent with the "scanned state wins" philosophy)
                    // Action: Remove pending action when consistent with scanned config by updating relation syncState to "scanned"
                    logger.debug('[performImport] Removing pending action for server:', scannedServer.serverName);
                    clientServerRelation.syncState = "scanned";
                    await clientServerModel.update(clientServerRelation.clientServerId, clientServerRelation);
                }
            } else {
                // If the servers are different, we need to update the relation to point to the correct server and set the syncState to "scanned"
                if (scannedServer.isManaged) {
                    // If the scanned server is managed, we need to update the relation to point to the correct server
                    const serverFromSystem = await serverModel.findByToken(scannedServer.serverToken!);
                    if (serverFromSystem) {
                        // Action: Update relation to point to correct server
                        logger.debug('[performImport] Updating relation to managed server:', scannedServer.serverToken);
                        clientServerRelation.serverId = serverFromSystem.serverId;
                    } else {
                        // Error (client refers to a managed server that doesn't exist)
                        logger.error('[performImport] Error: Managed server not found in system:', scannedServer.serverToken);
                    }                    
                } else {
                    // If the scanned server is unmanaged, we need create a new unmananged server and update the relation to point to it
                    logger.debug('[performImport] Creating new unmanaged server:', scannedServer.serverName);
                    const newServer = await serverModel.create({
                        name: scannedServer.serverName,
                        config: setDefaultCwd(scannedServer.config, client),
                        security: "unmanaged", 
                        enabled: true
                    });
                    clientServerRelation.serverId = newServer.serverId;
                }
                if (server.security === "unmanaged") {
                    // If we're replacing an unmanaged server, we need to delete the referenced unmanaged server (since it will no longer be in use)
                    logger.debug('[performImport] Deleting unmanaged server:', server.name);
                    await serverModel.delete(server.serverId);
                    serverMap.delete(server.serverId);
                }
                clientServerRelation.syncState = "scanned";
                await clientServerModel.update(clientServerRelation.clientServerId, clientServerRelation);
            }
            removeProcessedRelation(clientServerRelations, relation => relation.clientServerId === relation.clientServerId);
        } else {
            // No current relation for this scanned client (no relation where managedServerName matches clientServerName)
            if (scannedServer.isManaged) {
                // Managed server not referenced by any clientServerRelation
                // How: User added managed server to client config manually
                // See if we have an existing clientServerRelation with server name that matches the managed server name from the scanned server
                const managedServer = servers.find(server => server.token === scannedServer.serverToken);
                if (managedServer) {
                    // Update the relation to reflect the scanned server's managed server name (it is guaranteed to exist if the server was found)
                    logger.debug('[performImport] Updating relation to managed server:', scannedServer.serverToken);
                    const relation = clientServerRelations.find(relation => relation.serverId === managedServer.serverId)!;
                    relation.clientServerName = scannedServer.serverName;
                    relation.syncState = "scanned";
                    await clientServerModel.update(relation.clientServerId, relation);
                    removeProcessedRelation(clientServerRelations, relation => relation.clientServerId === relation.clientServerId);
                } else {
                    // See if there is a managed server (in the system) that matches the scanned server's managed server token and create a new relation to it
                    const serverFromSystem = await serverModel.findByToken(scannedServer.serverToken!);
                    if (serverFromSystem) {
                        // Create a new relation to the managed server
                        logger.debug('[performImport] Creating new relation to managed server:', scannedServer.serverToken);
                        logger.debug(`[performImport] serverFromSystem: ${JSON.stringify(serverFromSystem, null, 2)}`);
                        logger.debug(`[performImport] client: ${JSON.stringify(client, null, 2)}`);
                        await clientServerModel.create({
                            clientId: client.clientId,
                            serverId: serverFromSystem.serverId,
                            clientServerName: scannedServer.serverName,
                            syncState: "scanned"
                        });
                    } else {
                        // Error (client refers to a managed server that doesn't exist)
                        logger.error('[performImport] Error: Managed server not found in system:', scannedServer.serverToken);
                    }
                }
            } else {
                // Unmanaged server not in use (by the client's server name)
                // How: New (or previously unseen) unmanaged server
                // Action: Create a new unmanaged server with the config from the scanned server and create a new relation to it
                logger.debug('[performImport] Creating new unmanaged server:', scannedServer.serverName);
                const newServer = await serverModel.create({
                    name: scannedServer.serverName,
                    config: setDefaultCwd(scannedServer.config, client),
                    security: "unmanaged", 
                    enabled: true
                });
                await clientServerModel.create({
                    clientId: client.clientId,
                    serverId: newServer.serverId,
                    clientServerName: scannedServer.serverName,
                    syncState: "scanned"
                });
            }
        }
    }

    // Review any leftover relations (not processed above)
    for (const clientServerRelation of clientServerRelations) {
        // A leftover "add" relation might be OK to leave
        // A leftover of any other state is for a server that doesn't exist on the client, and should be deleted
        //
        if (clientServerRelation.syncState !== "add") {
            // If the relation is not an "add", we need to delete it
            if (!clientServerRelation.serverId) {
                logger.debug('[performImport] Skipping relation with null serverId');
                continue;
            }
            const server = serverMap.get(clientServerRelation.serverId)!;
            if (server.security === "unmanaged") {
                // If the relationship we're deleting references an unmanaged server, we need to delete that unmanaged server (since it will no longer be referenced)
                logger.debug('[performImport] Deleting unmanaged server:', server.name);
                const serverDeleted = await serverModel.delete(server.serverId);
                if (!serverDeleted) {
                    logger.warn(`[performImport] Failed to delete unmanaged server ${server.serverId}`);
                }
                serverMap.delete(server.serverId);
            }
            const deleted = await clientServerModel.delete(clientServerRelation.clientServerId);
            if (!deleted) {
                logger.warn(`[performImport] Failed to delete client-server relation ${clientServerRelation.clientServerId}`);
            }
        }
    }

    // When all is said and done, each server will be one of:
    // - Managed and synced (in use)
    // - Managed and not-synced (pending add)
    // - Unmanaged (and synced)

    return {
        servers: [
            { serverId: 1, serverName: 'sqlite-imported' }
        ]
    };
}

export async function performConvert(client: ClientData, options: SyncOptions): Promise<ConvertResult[]> {
    // TODO: Implement convert logic
    //
    // Allow a param to specify a specific relation to convert (or all)
    //
    // We create the delete of the existing server and the add of the new server.  If autoUpdate is true, the caller will
    // also specificy to perform "update" as part of the scan operation, which will deploy to client and reconcile the 
    // clientServer relations.  If autoUpdate is false, the relations will be pending for the user to push (allowing them
    // to test the new managed server, and revert if desired).
    //
    const results: ConvertResult[] = [];

    const modelFactory = ModelFactory.getInstance();
    const clientServerModel = await modelFactory.getClientServerModel();
    const serverModel = await modelFactory.getServerModel();

    // Get all client-server relationships for this client
    const clientServerRelations = await clientServerModel.list({ clientId: client.clientId });
    
    // Filter by serverIds if provided
    let relationsToProcess = clientServerRelations;
    if (options.serverIds && options.serverIds.length > 0) {
        relationsToProcess = clientServerRelations.filter(relation => 
            relation.serverId !== null && options.serverIds!.includes(relation.serverId)
        );
        logger.debug(`[performConvert] Filtering to ${relationsToProcess.length} relations out of ${clientServerRelations.length} total`);
    }

    logger.debug(`[performConvert] relationsToProcess: ${JSON.stringify(relationsToProcess, null, 2)}`);

    // Let's get all the managed servers up front to use in our processing
    const { servers } = await serverModel.list({ managed: true }, { sort: 'asc', limit: 100 });

    for (const relation of relationsToProcess) {
        logger.debug(`[performConvert] processing relation: ${JSON.stringify(relation, null, 2)}`);
        if (relation.syncState === "scanned" || relation.syncState === "pushed") {
            if (!relation.serverId) {
                logger.debug('[performConvert] Skipping relation with null serverId');
                continue;
            }
            const currentServer = await serverModel.findById(relation.serverId);
            if (currentServer && currentServer.security === "unmanaged") {
                let isNewManagedServer = false;
                let managedServer = servers.find(server => {
                    // If the managed server is wrapped, unwrap it for comparison
                    const configToCompare = server.security === "wrapped" ? unwrapSecurity(server.config) : server.config;
                    return deepEqual(configToCompare, currentServer.config);
                });
                if (managedServer) {
                    logger.debug(`[performConvert] Found existing managed server with same config: ${managedServer.name}`);
                } else {
                    logger.debug(`[performConvert] No existing managed server with same config found for ${currentServer.name}, creating new one`);
                    // We don't have an existing managed server with the same config, so we need to create a new one
                    let config = currentServer.config;
                    let security: ServerSecurity = null;
                    if (options.convertWrapping && isSecurityWrappable(currentServer.config)) {
                        // If wrapping is enabled and the server is wrappable, wrap it
                        config = wrapSecurity(currentServer.config);
                        security = "wrapped";
                    }
                    managedServer = await serverModel.create({
                        name: currentServer.name,
                        config: config,
                        enabled: true,
                        security: security
                    });
                    // We need to add the new managed server to the servers list in case we encounter another server to convert that matches it
                    servers.push(managedServer); 
                    isNewManagedServer = true;
                }

                logger.debug(`[performConvert] Updating relation for ${currentServer.name} to point to managed server ${managedServer.name} with id ${managedServer.serverId}`);

                // Mark the existing relation as pending delete
                relation.syncState = 'deleteScanned';
                await clientServerModel.update(relation.clientServerId, relation);
                // Create a new relation for the managed server
                await clientServerModel.create({
                    clientId: client.clientId,
                    serverId: managedServer.serverId,
                    clientServerName: relation.clientServerName,
                    toolNames: relation.toolNames,
                    syncState: 'add'
                });
                results.push({
                    clientId: client.clientId,
                    clientServerName: relation.clientServerName!,
                    managedServer: {
                        serverId: managedServer.serverId,
                        isNew: isNewManagedServer
                    }
                });
            }
        }
    }

    return results;
}

// Options: serverIds, if present, filters the list of relations to update by the provided serverIds
//    
export async function performUpdate(client: ClientData, options: SyncOptions, configService: McpConfigFileService): Promise<UpdateResults> {
    const modelFactory = ModelFactory.getInstance();
    const clientServerModel = await modelFactory.getClientServerModel();
    const serverModel = await modelFactory.getServerModel();

    // Get all client-server relationships for this client
    const clientServerRelations = await clientServerModel.list({ clientId: client.clientId });
    
    // Filter by serverIds if provided
    let relationsToProcess = clientServerRelations;
    if (options.serverIds && options.serverIds.length > 0) {
        relationsToProcess = clientServerRelations.filter(relation => 
            options.serverIds!.includes(relation.serverId)
        );
        logger.debug(`[performUpdate] Filtering to ${relationsToProcess.length} relations out of ${clientServerRelations.length} total`);
    }

    // For any pending delete, we need to include any corresponding add (in delete/add pair, as in server import), even if it's not in the above filtered list
    for (const relation of relationsToProcess) {
        if (relation.syncState === "deleteScanned" || relation.syncState === "deletePushed") {
            const addRelation = clientServerRelations.find(r => r.clientServerName === relation.clientServerName && (r.syncState === "add"));
            if (addRelation && !relationsToProcess.some(r => r.clientServerId === addRelation.clientServerId)) {
                relationsToProcess.push(addRelation);
            }
        }
    }

    function removeProcessedRelation(clientServerId: number) {
        const index = relationsToProcess.findIndex(relation => relation.clientServerId === clientServerId);
        if (index !== -1) {
            relationsToProcess.splice(index, 1);
        }
    }

    const servers = await serverModel.getByIds(relationsToProcess.map(relation => relation.serverId).filter((id): id is number => id !== null));
    const serverMap = new Map(servers.map(server => [server.serverId, server]));

    logger.debug(`[performUpdate] relationsToProcess: ${JSON.stringify(relationsToProcess, null, 2)}`);

    // Process server deletions first
    for (const relation of relationsToProcess.filter(r => r.serverId === null)) {
        logger.debug(`[performUpdate] processing delete server for relation: ${JSON.stringify(relation, null, 2)}`);
        if (relation.syncState !== "add") {
            logger.debug(`[performUpdate] deleting server config for ${relation.clientServerName}`);
            configService.removeServer(relation.clientServerName!);
        }
        const deleted = await clientServerModel.delete(relation.clientServerId);
        if (!deleted) {
            logger.warn(`[performUpdate] Failed to delete client-server relation ${relation.clientServerId}`);
        }
        removeProcessedRelation(relation.clientServerId);
    }

    // Process server relationship deletions next
    for (const relation of relationsToProcess.filter(r => r.syncState === "deleteScanned" || r.syncState === "deletePushed")) {
        logger.debug(`[performUpdate] processing delete relation: ${JSON.stringify(relation, null, 2)}`);
        // See if there is a pending add for the same clientServerName
        const addRelation = clientServerRelations.find(r => r.clientServerName === relation.clientServerName && (r.syncState === "add"));
        if (addRelation) {
            logger.debug(`[performUpdate] found add relation for delete relation: ${JSON.stringify(addRelation, null, 2)}`);
            // If there is a pending add, we need to update the config in-situ
            if (!addRelation.serverId) {
            logger.debug('[performUpdate] Skipping addRelation with null serverId');
            continue;
        }
        const server = serverMap.get(addRelation.serverId)!;
            const managedServerConfig = getManagedServerConfig(client, server);
            configService.updateServer(relation.clientServerName!, managedServerConfig);
            // Then update the add relation to "pushed"
            removeProcessedRelation(addRelation.clientServerId);
            await clientServerModel.update(addRelation.clientServerId, { syncState: "pushed" });
        } else {
            logger.debug(`[performUpdate] no add relation found for delete relation, deleting server config`);
            // If there is no pending add, we need to delete the server config
            configService.removeServer(relation.clientServerName!);
        }
        const deleted = await clientServerModel.delete(relation.clientServerId);
        if (!deleted) {
            logger.warn(`[performUpdate] Failed to delete client-server relation ${relation.clientServerId}`);
        }
        removeProcessedRelation(relation.clientServerId);

        const removedServer = relation.serverId ? serverMap.get(relation.serverId) : null;
        if (removedServer && removedServer.security === "unmanaged") {
            // If the server relation we deleted was for an unmanaged server, we need to delete the server from the system
            logger.debug(`[performUpdate] deleting unmanaged server: ${removedServer.name}`);
            const serverDeleted = await serverModel.delete(removedServer.serverId);
            if (!serverDeleted) {
                logger.warn(`[performUpdate] Failed to delete unmanaged server ${removedServer.serverId}`);
            }
        }
    }

    logger.debug('[performUpdate] processing add relations, relationsToProcess:', relationsToProcess.length);

    // Process remaining add relationships
    for (const relation of relationsToProcess.filter(r => r.syncState === "add")) {
        logger.debug('[performUpdate] processing add relation:', relation);
        // If there is a pending add, we need to add the client config
        if (!relation.serverId) {
            logger.debug('[performUpdate] Skipping relation with null serverId');
            continue;
        }
        const server = serverMap.get(relation.serverId)!;
        let clientServerName = relation.clientServerName ?? server.name;
        const currentMcpServers = configService.getMcpServers();
        if (currentMcpServers && currentMcpServers[clientServerName] !== undefined) {
            // If there are current mcpServers and the clientServerName is already in use, we need to find a unique name
            // We'll start with the clientServerName and append an increasing numeric suffix until unique
            for (let i = 0; i < 100; i++) {
                const testName = clientServerName + (i > 0 ? `-${i}` : '');
                if (!currentMcpServers || currentMcpServers[testName] === undefined) {
                    clientServerName = testName;
                    break;
                }
            }
        }
        const managedServerConfig = getManagedServerConfig(client, server);
        configService.addServer(clientServerName!, managedServerConfig);
        // Then update the relation to "pushed"
        removeProcessedRelation(relation.clientServerId);
        await clientServerModel.update(relation.clientServerId, { syncState: "pushed", clientServerName: clientServerName });
    }

    logger.debug('[performUpdate] mcpServers updated via configService');
    
    return {
        mcpServersUpdated: true,
        updates: [
            { clientServerName: 'sqlite', serverName: 'sqlite-managed' }
        ]
    };
} 