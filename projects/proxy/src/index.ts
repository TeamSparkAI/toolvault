import { ErrorCode, JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { startBridge, ServerEndpointConfig, ClientEndpointConfig, BaseMessageProcessor, ServerEndpoint } from 'toolvault-bridge';
import logger from './logger';
import { getApiConfigPath } from '../../shared/utils/paths';
import * as fs from 'fs';
import { userInfo } from 'os';

let serverEndpoint: ServerEndpoint;
let clientEndpointConfig: ClientEndpointConfig;
let args: string[];

// Retry logic: We start with a timer based retry with a max retires and a backoff interval
// - When timer fires, go to fetching
//   - If retryabale failure, back to waitingForTimer, back off and set new timer
//   - If permanent failure, exit
// - When the max timeouts have been reached, we will switch to a waiting for message state
// - When we get a message
//   - If we're in waitingForTimer, we will cancel the timer
//   - Go to fetching, if load fails, we exit (can't process message)

// If we get another ConnectionClosed error within this timeout, we will not attempt to replace the config, we'll 
// assume it's a legit connection error of some other kind and we'll exit.
//
const NO_REPLACE_CONFIG_TIMEOUT = 1000 * 30; // 30 seconds

// This will be our max retries and backoff intervals (indexed by retry count)
const timerIntervals = [
    3000,  // 3 seconds
    15000, // 15 seconds
    30000, // 30 seconds
    60000, // 1 minute
]

type ReplaceConfigState = 'none' | 'waitingForTimer' | 'fetching' | 'waitingForMessage';

interface ReplaceConfigStatus {
    state: ReplaceConfigState;
    pendingTimer?: NodeJS.Timeout;
    timerRetryCount?: number;
    configLastUpdated?: Date;
}

let replaceConfigStatus: ReplaceConfigStatus = {
    state: 'none',
    timerRetryCount: 0
};

function scheduleRetry() {
    const retryCount = replaceConfigStatus.timerRetryCount ?? 0;
    if (retryCount < timerIntervals.length) {
        const interval = timerIntervals[retryCount];
        logger.info('[Proxy] Scheduling retry of fetch of new client endpoint config in', interval, 'ms');
        replaceConfigStatus.state = 'waitingForTimer';
        replaceConfigStatus.pendingTimer = setTimeout(() => {
            logger.info('[Proxy] Timer fired, retrying fetch of new client endpoint config');
            replaceConfigStatus.pendingTimer = undefined;
            replaceConfigStatus.timerRetryCount = retryCount + 1;
            replaceClientEndpointConfig();
        }, interval);
    } else {
        // Max retries reached, switch to waiting for message
        logger.info('[Proxy] Max retries reached, switching to waiting for message');
        replaceConfigStatus.state = 'waitingForMessage';
        replaceConfigStatus.pendingTimer = undefined;
    }
}

async function replaceClientEndpointConfig(forceExitOnFail = false): Promise<boolean> {
    if (replaceConfigStatus.state === 'fetching') return false;

    logger.info('[Proxy] Attempting to replace client endpoint config');
    replaceConfigStatus.state = 'fetching';
    let newClientEndpointConfig: ClientEndpointConfig;
    try {
        newClientEndpointConfig = await getClientEndpointConfig();
    } catch (error) {
        if (error instanceof RetryableError) {
            logger.warn('[Proxy] Retryable error while replacing client endpoint config (will retry):', error.message);
            if (forceExitOnFail) {
                logger.error('[Proxy] Retryable failure getting new client endpoint config after disconnect (with message pending), exiting');
                process.exit(1);
            } else {
                scheduleRetry();
            }
        } else {
            logger.error('[Proxy] Permanent failure to get new client endpoint config after disconnect, exiting:', error);
            process.exit(1);
        }
        return false;
    }

    replaceConfigStatus.timerRetryCount = 0;
    replaceConfigStatus.state = 'none';
    replaceConfigStatus.configLastUpdated = new Date();

    logger.info('[Proxy] Replacing client endpoint config');
    await serverEndpoint.updateClientEndpoint(newClientEndpointConfig);
    return true;
}

class RetryableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RetryableError';
    }
}

// This not only gets the config, but it also validates that the API server is running and the gateway is running (it will
// throw a RetryableError if either the API server is not running or the gateway is not running).
//
async function getClientEndpointConfig(): Promise<ClientEndpointConfig> {
    const configPath = getApiConfigPath();

    // Check for config file existence
    try {
        await fs.promises.access(configPath);
    } catch {
        throw new RetryableError(`[Proxy] API config file not found. ToolVault server likely not running?\n[Proxy] Expected config file: ${configPath}`);
    }

    let apiPath: string;
    try {
        const configData = await fs.promises.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        if (!config.apiPath) {
            throw new Error(`[Proxy] API config file is missing apiPath property\n[Proxy] Config file: ${configPath}`);
        }
        apiPath = config.apiPath;
    } catch (err) {
        throw new Error(`[Proxy] Failed to read or parse API config: ${err}\n[Proxy] Config file: ${configPath}`);
    }

    const apiEndpoint = `${apiPath}/api/v1/proxy`;
    const userName = process.env.TSH_USER || userInfo().username;

    let serverResponse;
    try {
        serverResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: userName, args })
        });
    } catch (err) {
        throw new RetryableError(`[Proxy] Failed to connect to API endpoint: ${err}`);
    }

    if (serverResponse.status === 503) {
        // The gateway is not running, so we can't get the config (we can try again later)
        throw new RetryableError(`[Proxy] API endpoint returned 503: ${serverResponse.statusText}`);
    }

    if (!serverResponse.ok) {
        throw new Error(`[Proxy] API endpoint returned error: ${serverResponse.status} ${serverResponse.statusText}`);
    }

    const serverResponseJson = await serverResponse.json();
    const clientConfig = serverResponseJson.config;
    logger.info('[Proxy] Client endpoint config:', clientConfig);

    let config: ClientEndpointConfig;
    switch (clientConfig.type) {
        case 'stdio':
            config = {
                mode: 'stdio',
                command: clientConfig['command'],
                args: clientConfig['args'],
                env: clientConfig['env']
            }
            break;
        case 'sse':
            config = {
                mode: 'sse',
                endpoint: clientConfig['url'],
                endpointHeaders: clientConfig['headers']
            }
            break;
        case 'streamable':
            config = {
                mode: 'streamable',
                endpoint: clientConfig['url'],
                endpointHeaders: clientConfig['headers']
            }
            break;
        default:
            logger.error('[Proxy] Unsupported client type:', clientConfig['type']);
            throw new Error(`[Proxy] Unsupported client type: ${clientConfig['type']}`);
    }

    return config;
}

async function start() {
    // Get first command line param as server name
    args = process.argv.slice(2);
    
    // Check for --help argument
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
ToolVault Proxy (tsh)

Usage: tsh <server-token> [options]

Arguments:
  <server-token>     Server token to connect to

Options:
  --help, -h         Show this help message

Examples:
  tsh <server-token>     # Connect to server with token
  tsh --help            # Show this help message

The proxy connects to the ToolVault server using the provided token.
`);
        process.exit(0);
    }
    
    if (args.length === 0) {
        logger.error('Server token is required as first argument');
        console.log(`
Usage: tsh <server-token>

Run 'tsh --help' for more information.
`);
        process.exit(1);
    }

    const serverEndpointConfig: ServerEndpointConfig = {
        mode: 'stdio'
    };

    try {
        clientEndpointConfig  = await getClientEndpointConfig();
    } catch (error) {
        logger.error('[Proxy] Failed to get client endpoint config:', error);
        process.exit(1);
    }

    const messageProcessor: BaseMessageProcessor = {
        // Process messages going to the server
        forwardMessageToServer: async (serverName: string, sessionId: string, message: JSONRPCMessage) => {
            if (replaceConfigStatus.state === 'waitingForTimer' || replaceConfigStatus.state === 'waitingForMessage') {
                if (replaceConfigStatus.pendingTimer) {
                    clearTimeout(replaceConfigStatus.pendingTimer);
                    replaceConfigStatus.pendingTimer = undefined;
                }
                // Pass true to force exit on fail
                await replaceClientEndpointConfig(true);
                // The bridge should be in reconfiguring mode after this and put this message in the pending queue
            } else if (replaceConfigStatus.state === 'fetching') {
                // !!! What we really need to do here is wait until the fetch is complete and then process the message if it succeeded, else exit if it failed
                logger.error("[Proxy]Got new message for server while fetching new client endpoint config");
            }
            return message;
        },
        // Process messages returning to the client
        returnMessageToClient: async (serverName: string, sessionId: string, message: JSONRPCMessage) => {
            if ('error' in message && message.error) {
                // There are certain errors that are non-recoverable (for example, if the server stopped and restarted, which could change
                // the API server or gateway port, and would invalidate our config, particularly the bearer token). In these cases we will
                // get connect failures or auth failures.  In these cases we will re-get our client endpoint config, and if it has changed,
                // we will try to update the bridge with the new endpoint (which will renegotiate the protocol if needed) and allow us to
                // continue seamlesslely without our client being any the wiser.
                //
                // Similarly if the managed server we're connecting to was updated we would get a disconnect.  We've added the server updatedAt
                // to the proxy client endpoint config so this will also trigger a replace endpoint config (it's effectively the same config
                // in that case, but the reconnect is required to connect to the updated server).
                //
                if (message.error.code === ErrorCode.ConnectionClosed) {
                    if (replaceConfigStatus.state === 'none') {
                        if (replaceConfigStatus.configLastUpdated && new Date().getTime() - replaceConfigStatus.configLastUpdated.getTime() < NO_REPLACE_CONFIG_TIMEOUT) {
                            logger.error("[Proxy] Got connection closed error, but config has been updated within", NO_REPLACE_CONFIG_TIMEOUT, "ms, exiting");
                            process.exit(1);
                        }
                        logger.error("[Proxy] Got connection closed error, attempting to replacing client endpoint config");
                        // We're going to call this async method but not await it (it might do retries, wait for next message, etc)
                        replaceClientEndpointConfig();    
                    } else {
                        logger.error("[proxy] Got subsequent connection closed error with pending replacing client endpoint config, noop");
                    }
                    return null;
                }
                logger.error('[Proxy] Returning error message to client', message);
            }
            return message;
        },
    };

    // Start bridge with client endpoint config
    try {
        logger.info('[Proxy] Starting bridge with config:', serverEndpointConfig);
        logger.info('[Proxy] Starting bridge with client endpoint:', clientEndpointConfig);
        serverEndpoint = await startBridge(serverEndpointConfig, [clientEndpointConfig], messageProcessor, 'debug');
    } catch (error) {
        logger.error('[Proxy] Failed to start bridge:', error);
        process.exit(1);
    }
}

async function stop() {
    logger.info('[Proxy] Shutting down...');
    await serverEndpoint.stop();
    process.exit(0);
}

process.on('SIGINT', async () => {
    logger.info('[Proxy] SIGINT received, shutting down...');
    stop();
});

start();