import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { ClientEndpointConfig } from "../types/config";
import logger from "../logger";

export class ClientEndpoiontStreamable extends ClientEndpoint {
    private endpoint: URL;
    private headers: Record<string, string>;
    private transports: Map<string, StreamableHTTPClientTransport> = new Map();
  
    constructor(config: ClientEndpointConfig) {
        super(config);
        if (!config.endpoint) {
            throw new Error('Client endpoint is required');
        }
        this.endpoint = new URL(config.endpoint);
        this.headers = config.endpointHeaders || {};
    }

    async startSession(session: Session): Promise<void> {
        try {
            logger.debug(`Connecting to Streamable client endpoint: ${this.endpoint}`);
            const streamableClient = new StreamableHTTPClientTransport(this.endpoint, {
                requestInit: {
                    headers: this.headers
                }
            });
            this.transports.set(session.id, streamableClient);

            streamableClient.onmessage = async (message: JSONRPCMessage) => {
                logger.debug(`Received message from Streamable client endpoint: ${message}`);
                await session.returnMessageToClient(message);
            };
        
            streamableClient.onerror = async (error: Error) => {
                logger.error(`Streamable client - Server Error: ${error}`);
                let errorMessage: JSONRPCMessage | null = null;
                const connectionErrorSignals = [
                    "terminated: other side closed",
                    "stream disconnected",
                    "Maximum reconnect attempts"
                ];
                if (connectionErrorSignals.some(signal => error?.message?.includes(signal))) {
                    // We get a connection closed from the other end, send that along to the client as a structured ConnectionClosed error
                    errorMessage = jsonRpcError(error.toString(), { code: ErrorCode.ConnectionClosed });
                } else {
                    // If error.message exists, attempt to extract error code and process
                    //   SSE client - Server Error: Error: SSE error: Non-200 status code (400)
                    //   SSE client - Server Error: Error: Error POSTing to endpoint (HTTP 400): No active session
                    const httpErrorCode = error?.message?.match(/\((?:HTTP )?(\d+)\)/)?.[1];
                    if (httpErrorCode === '401') {
                        // We get a 401 on invalid auth (including invalid session, which can happen on client endpoint restart).  Send that
                        // along to the client as a structured Unauthorized error (to cause disconnect and ideally reconnect).
                        errorMessage = jsonRpcError(error.toString(), { code: ErrorCode.ConnectionClosed });
                    }
                }
    
                if (!errorMessage) {
                    errorMessage = jsonRpcError(error.toString());
                }
                await session.returnMessageToClient(errorMessage);
            };

            streamableClient.onclose = async () => {
                logger.debug('Streamable client session closed');
                await session.onClientEndpointClose();
                this.transports.delete(session.id);
            };

            await streamableClient.start();
            logger.debug('Connected to streamable client endpoint for session:', session.id);
        } catch (error) {
            logger.error('Error starting streaming session:', error);
            throw error;
        }
    }

    async sendMessage(session: Session, message: JSONRPCMessage): Promise<void> {
        const streamableClient = this.transports.get(session.id);
        if (streamableClient) {
            logger.debug(`Forwarding message to Streamable client endpoint: ${message}`);
            streamableClient.send(message);
        } else {
            logger.error('No Streamable client transport found for session:', session.id);
        }
    }

    async closeSession(session: Session): Promise<void> {
        logger.debug('Closing Streamable client endpoint for session:', session.id);
        const streamableClient = this.transports.get(session.id);
        if (streamableClient) {
            await streamableClient.close();
            this.transports.delete(session.id);
        } else {
            logger.debug('No Streamable client transport to close for session:', session.id);
        }
    }
} 