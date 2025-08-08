import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { ClientEndpointConfig } from "../types/config";
import { expandPath, expandPaths } from "../../../shared/utils/pathExpansion";
import logger from "../logger";

interface JsonParseErrorInfo {
    originalString: string;
    wasTruncated: boolean;
    fullError: string;
}

function extractJsonParseError(error: Error): JsonParseErrorInfo | null {
    // Check if it's a JSON.parse error
    if (error instanceof SyntaxError && error.message.includes('is not valid JSON')) {
        // Extract the original string from the error message
        const match = error.message.match(/\"([^\"]+)\"(\.\.\.)? is not valid JSON/);
        if (match) {
            const originalString = match[1];
            const wasTruncated = match[2] === '...';
            return {
                originalString,
                wasTruncated,
                fullError: error.message
            };
        }
    }
    return null;
}

export class ClientEndpointStdio extends ClientEndpoint {
    private command: string;
    private args: string[];
    private env: Record<string, string> | undefined;
    private cwd: string | undefined;
    private transports: Map<string, { transport: StdioClientTransport, pendingMessageId: number | null }> = new Map();
    private seenJsonRpcMessage: boolean = false;
  
    constructor(config: ClientEndpointConfig) {
        super(config);
        if (!config.command) {
            throw new Error('Client command is required');
        }
        this.command = config.command;
        this.args = config.args || [];
        this.env = config.env;
        this.cwd = config.cwd;
    }
 
    private getStdioServerParameters(): StdioServerParameters {
        const params: StdioServerParameters = { command: this.command, args: this.args, env: this.env, cwd: this.cwd };
        params.stderr = 'pipe';

        if (params.args && params.args.length > 0) {
            params.args = expandPaths(params.args);
        }

        if (params.env) {
            params.env = Object.fromEntries(Object.entries(params.env).map(([key, value]) => [key, expandPath(value)]));
        }

        if (params.cwd) {
            params.cwd = expandPath(params.cwd);
        }

        logger.debug("Stdio server parameters:", params);
        return params;
    }

    async startSession(session: Session): Promise<void> {  
        // Connect to the stdio endpoint
        logger.debug('Connecting to stdio client endpoint:', this.command);
        const params = this.getStdioServerParameters();
        const stdioClient = new StdioClientTransport(params);
        const entry = { transport: stdioClient, pendingMessageId: null as number | null };
        this.transports.set(session.id, entry);

        if (stdioClient.stderr) {  
            stdioClient.stderr.on('data', (data: Buffer) => {
                const logEntry = data.toString().trim();
                logger.debug('Stdio client - stderr:', logEntry);
                this.logEvent(logEntry);
            });
        }

        await stdioClient.start();

        stdioClient.onmessage = async (message: JSONRPCMessage) => {
            logger.debug('Received message from stdio client endpoint:', message);
            this.seenJsonRpcMessage = true;
            if ('id' in message && typeof message.id === 'number' && message.id === entry.pendingMessageId) {
                entry.pendingMessageId = null;
            }
            await session.returnMessageToClient(message);
        };

        stdioClient.onerror = async (error: Error) => {
            if (!this.seenJsonRpcMessage) {
                const jsonParseError = extractJsonParseError(error);
                if (jsonParseError) {
                    // If we see non-JSON output before the first JSONRPC message, we'll send it to the endpoint log and log
                    // as debug instead of returning an error to the client (it's not uncommon for stdio MCP servers to burp
                    // out some non-JSON to stdout before they start talking JSONRPC).
                    logger.debug('Stdio client - Non-JSON to stdout before first JSONRPC message:', jsonParseError.originalString);
                    this.logEvent(jsonParseError.originalString + (jsonParseError.wasTruncated ? '...' : ''));
                    return;
                } 
            }
            logger.error('Stdio client - Server Error:', error);
            const errorMessage: JSONRPCMessage = jsonRpcError(error.toString());
            await session.returnMessageToClient(errorMessage);
        };

        stdioClient.onclose = async () => {
            logger.debug('Stdio client session closed (server terminated)');
            if (entry.pendingMessageId !== null) {
                // We closed (the server terminated) with a pending message, so we need to return an error to the client for that
                // message (or the client won't terminate properly or with a decent error message).
                await session.returnMessageToClient(jsonRpcError('Server closed with message pending', {id: entry.pendingMessageId}));
                entry.pendingMessageId = null;
            }
            await session.onClientEndpointClose();
            this.transports.delete(session.id);
        };
    }
  
    async sendMessage(session: Session, message: JSONRPCMessage): Promise<void> {
        const entry = this.transports.get(session.id);
        if (entry) {
            logger.debug('Forwarding message to stdio client endpoint:', message);
            if ('id' in message && typeof message.id === 'number') {
                entry.pendingMessageId = message.id;
            }
            entry.transport.send(message);
        } else {
            logger.error('No stdio client transport found for session:', session.id);
        }
    }
   
    async closeSession(session: Session): Promise<void> {
        logger.debug('Closing stdio client endpoint for session:', session.id);
        const entry = this.transports.get(session.id);
        if (entry) {
            await entry.transport.close();
            this.transports.delete(session.id);
        } else {
            logger.debug('No stdio client transport to close for session:', session.id);
        }
    }
}