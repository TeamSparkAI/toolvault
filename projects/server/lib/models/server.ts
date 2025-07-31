import { homedir } from 'os';
import { pathExists } from '../utils/fs';
import { ModelFactory } from './index';
import { McpServerConfig } from '@/lib/types/server';
import { ServerData, ServerFilter, ServerListResult, ServerPagination } from './types/server';
import { logger } from '../logging/server';
import { BridgeManager } from '../bridge/BridgeManager';
import { NPX_RUNNER_IMAGE, UVX_RUNNER_IMAGE } from '../config/containers';

export abstract class ServerModel {
    abstract findById(serverId: number): Promise<ServerData | null>;
    abstract findByToken(token: string): Promise<ServerData | null>;
    abstract list(filter: ServerFilter, pagination: ServerPagination): Promise<ServerListResult>;
    abstract create(data: Omit<ServerData, 'serverId' | 'token' | 'createdAt' | 'updatedAt'> & { token?: string }): Promise<ServerData>;
    abstract update(serverId: number, data: Partial<ServerData>): Promise<ServerData>;
    abstract delete(serverId: number): Promise<void>;
    abstract getByIds(serverIds: number[]): Promise<ServerData[]>;

    async getMcpServerConfigForProxy(serverToken: string, bearerToken: string): Promise<McpServerConfig> {
        const hostModel = await ModelFactory.getInstance().getHostModel();
        const mcpHost = await hostModel.get();

        const bridgeManager = BridgeManager.getInstance();
        const actualPort = bridgeManager.getActualPort();

        const url = `http://${mcpHost.host ?? 'localhost'}:${actualPort ?? mcpHost.port}/${serverToken}/${mcpHost.type === 'sse' ? 'sse' : 'mcp'}`;

        return {
            type: mcpHost.type,
            url: url,
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
            }
        }
    }

    // We assume that this will only be called on a wrapped config (where we created all volumne mounts from args).
    //
    // Inspect volume mounts and remove any that don't represent existing paths.  When wrapping a server in a container
    // we attempt to create volume mounts for any args that look like paths.  This generally shouldn't hurt anything even
    // if the args are not really paths.  But Docker will create host paths that don't exist when setting up the volume mount,
    // so we don't want to have volume mounts for non-existent host paths creating an unwanted side-effect (of creating these 
    // likely non-paths as paths on the system).  We generate the wrapped config from UX code where we don't have access to
    // the file system to validate the paths, so instead we do it on server create/update (which both call this helper method).
    //
    // !!! In a future state where we support Windows paths, and we find a volumne mount with non-existent host path,
    //     we'll need to get the container path, find the corresponding arg, and replace it with the host path (instead
    //     of just removing the identity volume mount as we do for Mac/Linux here).
    //
    // See: lib/utils/security.ts for more details on the wrapping/unwrapping design and mechanics.
    //
    // If we see a path with a ~ at the start, we replace it with the home directory.  The host path gets the ~ replaced with
    // the home directory of the local machine.  The container path gets the ~ replaced with /home (the home directory in
    // the container).  In this way an arg of "~/text.db" will get a volume mount of $HOME/text.db on the host and /home/text.db
    // in the container, and when the app in the container resolves the argument it will get /home/text.db.
    //
    protected async validateVolumeMounts(config: McpServerConfig): Promise<McpServerConfig> {
        logger.debug("[validMounts] validating volume mounts for config", config);
        if (config.type === 'stdio') {
            if (config.command === 'docker') {
                // Find the runner container argument
                let runnerIndex = -1;
                for (let i = 3; i < config.args.length; i++) {
                    if (config.args[i] === NPX_RUNNER_IMAGE || config.args[i] === UVX_RUNNER_IMAGE) {
                        runnerIndex = i;
                        break;
                    }
                }
                
                // Assuming the runner container was found, process any container arguments (env vars and volume mounts) between -i and runner container
                if (runnerIndex !== -1) {
                    for (let i = 3; i < runnerIndex; i++) {
                        if (i + 1 < runnerIndex) {
                            // We have a potential pair of args
                            if (config.args[i] === '-e') {
                                // Env var, ignore
                                i++; // Skip the next argument since we processed it
                            } else if (config.args[i].startsWith('-v')) {
                                // We have a potential volume mount - Note: there could be cases of non-identity volume mounts (Windows?) where
                                // we'd need to find the argument that matches the container path and replace it with the host path.
                                const volumeMount = config.args[i + 1];
                                const separatorIndex = volumeMount.indexOf(':');
                                if (separatorIndex !== -1) {
                                    const hostPath = volumeMount.substring(0, separatorIndex);
                                    const containerPath = volumeMount.substring(separatorIndex + 1);
                                    const expandedHostPath = hostPath.replace('~', homedir());
                                    if ((await pathExists(expandedHostPath)) === null) {
                                        // Remove this volume mount (set to empty, we'll remove them at the end)
                                        logger.debug("[unwrap] removing volume mount with non-existent host path", hostPath);
                                        config.args[i] = '';
                                        config.args[i + 1] = '';
                                    } else if (hostPath != expandedHostPath || containerPath.startsWith('~')) {
                                        config.args[i + 1] = expandedHostPath + ':' + (containerPath.startsWith('~') ? containerPath.replace('~', '/home') : containerPath);
                                    }
                                }
                                i++; // Skip the next argument since we processed it
                            }
                        }
                    }

                    // Remove any empty args (which we set to empty above)
                    config.args = config.args.filter(arg => arg !== '');
                }
            }
        }
        logger.debug("[validMounts] result", config);
        return config;
    }
} 