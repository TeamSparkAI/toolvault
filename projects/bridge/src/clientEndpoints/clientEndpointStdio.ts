import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { ClientEndpointConfig } from "../types/config";
import logger from "../logger";

export class ClientEndpointStdio extends ClientEndpoint {
    private command: string;
    private args: string[];
    private transports: Map<string, { transport: StdioClientTransport, pendingMessageId: number | null }> = new Map();
  
    constructor(config: ClientEndpointConfig) {
        super(config);
        if (!config.command) {
            throw new Error('Client command is required');
        }
        this.command = config.command;
        this.args = config.args || [];
    }
  
    async startSession(session: Session): Promise<void> {  
        // Connect to the stdio endpoint
        logger.debug('Connecting to stdio client endpoint:', this.command);
        const params: StdioServerParameters = { command: this.command, args: this.args };
        params.stderr = 'pipe';
        const stdioClient = new StdioClientTransport(params);
        const entry = { transport: stdioClient, pendingMessageId: null as number | null };
        this.transports.set(session.id, entry);

        if (stdioClient.stderr) {  
            stdioClient.stderr.on('data', (data: Buffer) => {
                const logEntry = data.toString().trim();
                logger.error('[mcp-link] stderr:', logEntry);
                this.logEvent(logEntry);
            });
        }

        await stdioClient.start();

        stdioClient.onmessage = async (message: JSONRPCMessage) => {
            logger.debug('Received message from stdio client endpoint:', message);
            if ('id' in message && typeof message.id === 'number' && message.id === entry.pendingMessageId) {
                entry.pendingMessageId = null;
            }
            await session.returnMessageToClient(message);
        };

        stdioClient.onerror = async (error: Error) => {
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