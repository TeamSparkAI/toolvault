// !!! This module is used from both front-end and back-end code, so there is no logging (we don't really have a logging solution for this scenario)

import { McpServerConfig, ServerSecurity } from '@/lib/types/server';

// Note: When we "wrap" a uvx/npx command in a container, we do it like this:
//
// docker run --rm -i [-e KEY=VALUE] [-v HOST_PATH:CONTAINER_PATH] teamspark/mcp-runner uvx [args]
// docker run --rm -i [-e KEY=VALUE] [-v HOST_PATH:CONTAINER_PATH] teamspark/mcp-runner npx [args]
//
// For volume mounts on Linux we require absolute paths and we use an identity mount, where the host path and container path are the same (and the 
// same as the argument passed to the MCP server running in the container).
//
// !!! Windows Support
// 
//     Need to support drive letter paths (C:\some\path\to\file.txt) and UNC paths (\\server\share\path\to\file.txt)
//
//     We might have npx someServer C:\some\path\to\file.txt, but when we containerize that, we can't use the identity volume mount,
//     we'd need to do something like -v C:\some\path\to\file.txt:/data/file.txt and change the path argument to /data/file.txt
//
//     We also need to update lib/models/server.ts validateVolumeMounts to handle Windows paths (to undo them using the above model when the host path doesn't exist)
//
// The following methods can determine if a config is wrapped or unwrapped, and can wrap/unwrap a config (convert to and from the above container form)
//
export const runnerContainer = 'teamspark/mcp-runner';

export function getSecurityType(config: McpServerConfig, explicitSecurity?: ServerSecurity): ServerSecurity {
    // If security is explicitly set, use it
    if (explicitSecurity) {
        return explicitSecurity;
    }

    // Auto-determine based on configuration
    if (config.type === 'sse' || config.type === 'streamable') {
        return 'network';
    }

    if (config.type === 'stdio') {
        const command = config.command || '';
        if (command.includes('docker') || command.includes('podman')) {
            if (config.args && config.args.length >= 5 && config.args[0] === 'run' && config.args[1] === '--rm' && config.args[2] === '-i') {
                // Find the runner container argument (it could be after environment variables)
                let runnerIndex = -1;
                for (let i = 3; i < config.args.length; i++) {
                    if (config.args[i] === runnerContainer) {
                        runnerIndex = i;
                        break;
                    }
                }
                
                if (runnerIndex !== -1 && runnerIndex + 1 < config.args.length) {
                    const commandArg = config.args[runnerIndex + 1];
                    if (commandArg === 'npx' || commandArg === 'uvx') {
                        // Check that all arguments between -i and runner container are valid env var pairs or identity volume mounts
                        for (let i = 3; i < runnerIndex; i++) {
                            if (i + 1 >= runnerIndex) {
                                // Ran out of args without getting a pair, so this is not a wrapped config
                                return 'container';
                            }

                            if (config.args[i] === '-e') {
                                const envPair = config.args[i + 1];
                                if (envPair.indexOf('=') === -1) {
                                    // Not a valid KEY=value format
                                    return 'container';
                                }
                                i++; // Skip the next argument since we processed it
                            } else if (config.args[i] === '-v') {
                                // We have a volume mount
                                i++; // Skip the next argument since we processed it
                            }
                        }
                        return 'wrapped';
                    }
                }
            }
            return 'container';
        }
    }

    return null;
}

export function isSecurityWrappable(config: McpServerConfig): boolean {
    if (config.type === 'stdio') {
        if (config.command === 'uvx' || config.command === 'npx') {
            return true;
        }
    }
    return false;
}

export function isSecurityUnwrappable(config: McpServerConfig): boolean {
    return getSecurityType(config) === 'wrapped';
}

function isPathLike(arg: string): boolean {
    return arg.startsWith('/') || arg.startsWith('~');
}

export function wrapSecurity(config: McpServerConfig): McpServerConfig {
    if (config.type === 'stdio') {
        if (config.command === 'uvx' || config.command === 'npx') {
            const baseArgs = ['run', '--rm', '-i'];
            
            // Add environment variables as -e arguments
            const envArgs: string[] = [];
            if (config.env) {
                for (const [key, value] of Object.entries(config.env)) {
                    envArgs.push('-e', `${key}=${value}`);
                }
            }

            const volumeMounts: string[] = [];

            // Add volume mounts for the local cache (!!! VERY INSECURE TO GIVE RANDO npx/uvx CODE RW ACCESS TO MODULE CACHE)
            if (config.command === 'uvx') {
                volumeMounts.push('-v', `~/.toolvault/cache/uv:/usr/local/uv`);
            } else if (config.command === 'npx') {
                volumeMounts.push('-v', `~/.toolvault/cache/npm:/home/.npm`);
            }

            // Process args for things that look like paths and resolve to paths (expanding ~, etc)
            for (let i = 0; i < config.args.length; i++) {
                const arg = config.args[i];
                // We are going to require absolute paths that point to existing files or directories, which we will turn in to identity volume mounts
                // in the format -v /full/path/to/file:/full/path/to/file
                if (isPathLike(arg)) {
                    // !!! We'd really like to check to see if this path exists, but we're in sync UX code currently.
                    // !!! On Windows, we'd need to contrive a container path (a Linux path for the container) and replace the arg with that.
                    volumeMounts.push('-v', `${arg}:${arg}`);
                }
            }

            const remainingArgs = [config.command, ...config.args];
            
            return { 
                ...config, 
                command: 'docker', 
                args: [...baseArgs, ...envArgs, ...volumeMounts, runnerContainer, ...remainingArgs],
                env: undefined // Remove env since it's now in args
            };
        }
    }
    return config;
}

export function unwrapSecurity(config: McpServerConfig): McpServerConfig {
    if (config.type === 'stdio') {
        if (config.command === 'docker') {
            // Find the runner container argument
            let runnerIndex = -1;
            for (let i = 3; i < config.args.length; i++) {
                if (config.args[i] === runnerContainer) {
                    runnerIndex = i;
                    break;
                }
            }
            
            if (runnerIndex !== -1 && runnerIndex + 1 < config.args.length) {
                const command = config.args[runnerIndex + 1];
                const args = config.args.slice(runnerIndex + 2);
                
                // Extract environment variables from -e arguments
                const env: Record<string, string> = {};
                
                // Process arguments between -i and runner container
                for (let i = 3; i < runnerIndex; i++) {
                    if (i + 1 < runnerIndex) {
                        // We have a potential pair of args
                        if (config.args[i] === '-e') {
                            const envPair = config.args[i + 1];
                            const equalIndex = envPair.indexOf('=');
                            if (equalIndex !== -1) {
                                const key = envPair.substring(0, equalIndex);
                                const value = envPair.substring(equalIndex + 1);
                                env[key] = value;
                            }
                            i++; // Skip the next argument since we processed it
                        } else if (config.args[i].startsWith('-v')) {
                            // We have a potential volume mount - Note: there could be cases of non-identity volume mounts (Windows?) where
                            // we'd need to find the argument that matches the container path and replace it with the host path.
                            i++; // Skip the next argument since we processed it
                        }
                    }
                }
                
                const result: McpServerConfig = { 
                    ...config, 
                    command, 
                    args,
                };
                if (Object.keys(env).length > 0) {
                    result.env = env;
                }

                return result;
            }
        }
    }
    return config;
}