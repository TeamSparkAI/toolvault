import { Command } from 'commander';
import { BridgeConfig, BridgeServerMode, BridgeClientMode, ServerEndpointConfig, ClientEndpointConfig, LogLevel } from './types/config';
import logger from './logger';

import dotenv from 'dotenv';
dotenv.config();

function parseServerMode(envVar: string | undefined): BridgeServerMode {
    if (!envVar) {
        return 'stdio'; // Default mode
    }

    const mode = envVar.toLowerCase();
    if (mode === 'sse' || mode === 'stdio' || mode === 'streamable') {
        return mode;
    }

    logger.warn("Invalid server mode:", envVar);
    throw new Error(`Invalid server mode "${envVar}"`);
}

function parseClientMode(envVar: string | undefined): BridgeClientMode {
    if (!envVar) {
        return 'stdio-container'; // Default mode
    }

    const mode = envVar.toLowerCase();
    if (mode === 'stdio' || mode === 'sse' || mode === 'streamable' || mode === 'stdio-container') {
        return mode;
    }

    logger.warn("Invalid client mode:", envVar);
    throw new Error(`Invalid client mode "${envVar}"`);
}

interface CommandOptions {
    serverMode?: string;
    clientMode?: string;
    port?: string;
    host?: string;
    image?: string;
    endpoint?: string;
    command?: string;
    env: string[];
    volume: string[];
    logLevel?: LogLevel;
}

// Function to collect multiple values into an array
function collect(value: string, previous: string[]) {
    return previous.concat([value]);
}

export function createConfig(): BridgeConfig {
    // Create a new Command instance
    const program = new Command();

    // Configure the command line interface
    program
        .name('mcplink')
        .description('TeamSpark AI MCP Link')
        .option('--serverMode <mode>', 'Server mode (sse, stdio, streamable)', 'stdio')
        .option('--clientMode <mode>', 'Client mode (stdio, sse, streamable, stdio-container)', 'stdio-container')
        .option('--port <number>', 'Server port', '3000')
        .option('--host <string>', 'Server host', 'localhost')
        .option('--image <string>', 'Client container image')
        .option('--endpoint <string>', 'Client endpoint')
        .option('--command <string>', 'Client command')
        .option('--env <value>', 'Environment variable (key=value)', collect, [])
        .option('--volume <value>', 'Volume mapping', collect, [])
        .option('--logLevel <level>', 'Log level (error, warn, info, http, debug)', 'info')
        .allowUnknownOption()
        .allowExcessArguments()
        .addHelpText('after', `
Examples:
  $ mcplink --serverMode=stdio --clientMode=stdio-container --image=mcp/fetch
  $ mcplink --image=mcp/fetch
  $ mcplink --serverMode=sse --port=8080 --image=mcp/fetch
  $ mcplink --serverMode=streamable --clientMode=stdio --command=npx mcp-fetch
        `);

    // Parse command line arguments
    program.parse();

    // Show help if no arguments provided
    if (process.argv.length <= 2) {
        program.help();
    }

    const options = program.opts<CommandOptions>();
    const args = program.args;

    const serverConfig: ServerEndpointConfig = {
        mode: parseServerMode(options.serverMode || process.env.SERVER_MODE),
        port: parseInt(options.port || process.env.PORT || '3000'),
        host: options.host || process.env.HOST || 'localhost',
        logLevel: options.logLevel as LogLevel || process.env.LOG_LEVEL as LogLevel || 'info'
    };

    const clientConfig: ClientEndpointConfig = {
        mode: parseClientMode(options.clientMode || process.env.CLIENT_MODE),
        containerImage: options.image || process.env.CONTAINER_IMAGE,
        endpoint: options.endpoint || process.env.CLIENT_ENDPOINT,
        command: options.command || process.env.CLIENT_COMMAND,
        env: options.env.reduce((acc, curr) => {
            const [key, value] = curr.split('=');
            if (key && value) {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, string>),
        containerVolumes: options.volume,
        args: args
    };

    return {
        server: serverConfig,
        clients: [clientConfig]
    };
}
