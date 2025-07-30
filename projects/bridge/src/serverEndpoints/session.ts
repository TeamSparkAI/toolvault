import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { ClientEndpoint } from '../clientEndpoints/clientEndpoint';
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { EventEmitter } from 'events';
import logger from '../logger';
import { AuthorizedMessageProcessor, MessageProcessor } from "../types/messageProcessor";
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

export function jsonRpcError(message: string, { id, code = ErrorCode.InternalError }: { id?: number, code?: number } = {} ): JSONRPCMessage {
    return {
        jsonrpc: '2.0',
        id: id ?? "error",
        error: { code, message }
    };
}

function messagesEqual(message1: JSONRPCMessage, message2: JSONRPCMessage | undefined): boolean {
    if (!message2) return false;
    // In this particular case, it should be fine to require the messages to be exactly the same
    return JSON.stringify(message1) === JSON.stringify(message2);
}

export interface Session {
    get id(): string;  
    get serverName(): string | null;

    start(): Promise<void>;
  
    // Forward a message (typically a protocol message or request) from the client (via server endpoint) to the server (via client endpoint)
    forwardMessageToServer(message: JSONRPCMessage): Promise<void>;
    
    // Return a message (response, notification, or error) from the server (via client endpoint) to the client (via server endpoint)
    returnMessageToClient(message: JSONRPCMessage): Promise<void>;  

    close(): Promise<void>;

    // Called by client endpoints when they detect they have ended
    onClientEndpointClose(): Promise<void>;

    // Event emitter methods
    on(event: 'clientEndpointClose', listener: () => void): this;
    once(event: 'clientEndpointClose', listener: () => void): this;
    off(event: 'clientEndpointClose', listener: () => void): this;
}

export abstract class BaseSession<T extends Transport = Transport> extends EventEmitter {
    protected sessionId: string;
    protected _serverName: string | null;
    protected isActive: boolean = true;
    protected clientEndpoint: ClientEndpoint;
    private _transport: T;
    private transportType: string;
    private messageProcessor?: AuthorizedMessageProcessor;
    private authPayload?: any;

    // State we need for reconfiguring the session with a new client endpoint
    private initMessage?: JSONRPCMessage;
    private initMessageId: string | number | null = null;
    private initResponse?: JSONRPCMessage;
    private pendingMessage?: JSONRPCMessage;
    private isReconfiguring: boolean = false;

    constructor(sessionId: string, clientEndpoint: ClientEndpoint, transport: T, transportType: string, serverName: string | null, messageProcessor?: AuthorizedMessageProcessor) {
        super();
        this.sessionId = sessionId;
        this._serverName = serverName;
        this.clientEndpoint = clientEndpoint;
        this._transport = transport;
        this.transportType = transportType;
        this.messageProcessor = messageProcessor;
        this.authPayload = undefined;
    }

    get id(): string {
        return this.sessionId;
    }

    get serverName(): string | null {
        return this._serverName;
    }

    get transport(): T {
        return this._transport;
    }

    async start(): Promise<void> {
        try {
            await this.clientEndpoint.startSession(this);
            await this.transport.start();
            logger.debug(`Started ${this.transportType} session ${this.sessionId}`);
        } catch (error) {
            logger.error(`Error starting ${this.transportType} session ${this.sessionId}:`, error);
            throw error;
        }
    }

    // Attempt to update the client endpoint in place (including renegotiating the MCP session, if one is active)
    async updateClientEndpoint(clientEndpoint: ClientEndpoint): Promise<void> {
        logger.debug('[Session] Updating client endpoint to:', clientEndpoint);
        this.isReconfiguring = true;
        await this.clientEndpoint.closeSession(this);
        this.clientEndpoint = clientEndpoint;
        await this.clientEndpoint.startSession(this);

        if (this.initMessage) {
            // Resend the initialize message (if there is one recorded)
            logger.debug('[Session] Resending initialize message to server (while reconfiguring client endpoint):', this.initMessage);
            await this.clientEndpoint.sendMessage(this, this.initMessage);
        } else {
            // If we don't have a previous initialize message, the client hasn't done protocol init, so we don't have to fake it (we're in the correct state)
            this.isReconfiguring = false;
        }
    }

    async authorize(authHeader: string | null): Promise<any> {
        if (this.messageProcessor) {
            this.authPayload = await this.messageProcessor.authorize(this.serverName, authHeader);
        }
    }

    async forwardMessageToServer(message: JSONRPCMessage): Promise<void> {
        logger.debug('[Session] Forwarding message to server - isActive:', this.isActive, 'isReconfiguring:', this.isReconfiguring, 'message:', message);
        if (!this.isActive) return;

        // If this is the first initialize message, store it and return
        if (!this.initMessage && 'id' in message && 'method' in message && message.method === 'initialize') {
            this.initMessageId = message.id;
            this.initMessage = message;
        }

        logger.debug('[Session] Forwarding message to server (via client endpoint):', message);
        let finalMessage: JSONRPCMessage | null = message;
        if (this.messageProcessor) {
            finalMessage = await this.messageProcessor.forwardMessageToServer(this.serverName, this.sessionId, message, this.authPayload);
        }

        if (this.isReconfiguring && finalMessage) {
            logger.debug('[Session] Recieved message while reconfiguring client endpoint, holding for reconfiguration to complete:', message);
            this.pendingMessage = finalMessage;
            return;
        }

        if (finalMessage) {  
            await this.clientEndpoint.sendMessage(this, finalMessage);
        }
    }
    
    async returnMessageToClient(message: JSONRPCMessage): Promise<void> {
        logger.debug('[Session] Returning message to client - isActive:', this.isActive, 'isReconfiguring:', this.isReconfiguring, 'message:', message);
        if (!this.isActive) return;
        if (this.isReconfiguring) {
            // Is this message an init response that matches the stored init response?
            if (messagesEqual(message, this.initResponse)) {
                // Complete initialization
                logger.debug('[Session] Got matching initialize response (while reconfiguring client endpoint), sending initialized notification to client');
                await this.clientEndpoint.sendMessage(this, {
                    jsonrpc: '2.0',
                    method: 'notifications/initialized'
                });
                // Send any pending message (received while we were reconfiguring)
                if (this.pendingMessage) {
                    logger.debug('[Session] Sending pending message to client (while reconfiguring client endpoint):', this.pendingMessage);
                    await this.clientEndpoint.sendMessage(this, this.pendingMessage);
                    this.pendingMessage = undefined;
                }
            } else {
                // If we get an init response with different payload, or any other message, then we need to send a fatal error to the client
                logger.error('[Session] Received init response with different payload (while reconfiguring client endpoint), sending fatal error to client:', message);
                await this.clientEndpoint.sendMessage(this, {
                    jsonrpc: '2.0',
                    id: 'error',
                    error: {
                        code: ErrorCode.InternalError,
                        message: 'Failed to renegotiate MCP session (server changed or failed to respond to initialize)'
                    }
                });
            }

            this.isReconfiguring = false;
            return;
        }

        // If this is the response to the stored initialize message, store it and return
        if (!this.initResponse && 'id' in message && message.id === this.initMessageId) {
            this.initResponse = message;
        }

        logger.debug('[Session] Sending response to client (via server endpoint):', message);
        let finalMessage: JSONRPCMessage | null = message;
        if (this.messageProcessor) {
            finalMessage = await this.messageProcessor.returnMessageToClient(this.serverName, this.sessionId, message, this.authPayload);
        }
        if (finalMessage) {
            await this.transport.send(finalMessage);
        }
    }

    async close(): Promise<void> {
        if (!this.isActive) return;
        this.isActive = false;

        // Close our transport first to prevent any more messages from being sent
        logger.debug('Closing transport for session ID:', this.sessionId);
        await this.transport.close();
        // Then close the client endpoint
        logger.debug('Closing session for client endpoint');
        await this.clientEndpoint.closeSession(this);
    }

    async onClientEndpointClose(): Promise<void> {
        // If we're reconfiguring, we're going to swap a new client endpoint in place, so we don't want to close the session
        if (!this.isReconfiguring) {
            logger.debug(`Client endpoint closed for ${this.transportType} session ${this.sessionId}`);
            await this.close();
            // Server transports will be listening - they will remove the session from the session manager and do any other protocol-specific cleanup
            this.emit('clientEndpointClose');
        }
    }
}