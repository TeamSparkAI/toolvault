import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ClientEndpoint } from "./clientEndpoint";
import { jsonRpcError, Session } from "../serverEndpoints/session";
import { ErrorCode, JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { ClientEndpointConfig } from "../types/config";
import logger from "../logger";

export class ClientEndpointSse extends ClientEndpoint {
    private endpoint: URL;
    private headers: Record<string, string>;
    private transports: Map<string, SSEClientTransport> = new Map();
  
    constructor(config: ClientEndpointConfig) {
        super(config);
        if (!config.endpoint) {
            throw new Error('Client endpoint is required');
        }
        this.endpoint = new URL(config.endpoint);
        this.headers = config.endpointHeaders || {};
    }
  
    private createTransport() {
        // There is a nasty bug where when an SSE client transport loses connection, it will reconnect, but not renegotiate the MCP protocol, 
        // so the transport will be in a broken state and subsequent calls to fetch will fail.
        // https://github.com/modelcontextprotocol/typescript-sdk/issues/510    
        //
        // The workaround below is to intercept the session initialization fetch call to identify ones where the session will be corrupted
        // and recycle the transport accordingly.
        //
        // We would need to recycle the sseClient when this happens, which is complicated by the fact that the session has a reference to the
        // transport (versus a reference to the endpoint, which could forward the message to the transport).  That's a modestly good-sized 
        // refactor.
        //
        // !!! Ideally we should just fix this bug at the source and use the fixed lib.
        //
        let fetchCount: number = 0;

        const onEventSourceInitFetch = async (url: string | URL, init: RequestInit | undefined, headers?: Headers): Promise<Response> => {
            logger.debug(`[ClientEndpointSSE] onEventSourceInit, fetchCount: ${fetchCount}`);
            fetchCount++;
            if (fetchCount > 1) {
                logger.error('SSE Connection terminated, returning 401 to trigger restart (reconnect, auth, and protocol init)');
                return new Response(
                    JSON.stringify({ reason: 'SSE Connection terminated: reconnect, auth, and protocol init required' }),
                    {
                        status: 401,
                        statusText: 'SSE Connection terminated: reconnect, auth, and protocol init required',
                        headers: {
                           'Content-Type': 'application/json'
                        }
                    }
                );
            } else {
                return fetch(url.toString(), { ...init, headers });
            }
        };

        if (Object.keys(this.headers).length > 0) {
            // Create a fetch wrapper that adds headers
            const fetchWithHeaders = (url: string | URL, init?: RequestInit) => {
                const headers = new Headers(init?.headers);
                Object.entries(this.headers).forEach(([key, value]) => {
                    headers.set(key, value);
                });
                return onEventSourceInitFetch(url, init, headers);
            };
            
            const transport = new SSEClientTransport(this.endpoint, {
                eventSourceInit: {
                    fetch: fetchWithHeaders
                }
            });

            return transport;
        } else {
            return new SSEClientTransport(this.endpoint, {
                eventSourceInit: {
                    fetch: (url, init) => {
                        return onEventSourceInitFetch(url, init);
                    }
                }
            });
        }
    }

    async startSession(session: Session): Promise<void> {
        logger.debug(`Connecting to SSE client endpoint: ${this.endpoint}`);
        const sseClient = this.createTransport();
        await sseClient.start();
        this.transports.set(session.id, sseClient);

        sseClient.onmessage = async (message: JSONRPCMessage) => {
            logger.debug(`Received message from SSE client endpoint: ${JSON.stringify(message)}`);            
            await session.returnMessageToClient(message);
        };

        sseClient.onerror = async (error: Error) => {
            if (!error) return; // We see unexplained unddefined error from time to time (right before a legit error)
            logger.error(`SSE client - Server Error: ${error}`);
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

        sseClient.onclose = async () => {
            logger.debug('SSE client session closed');
            await session.onClientEndpointClose();
            this.transports.delete(session.id);
        };
    }

    async sendMessage(session: Session, message: JSONRPCMessage): Promise<void> {
        const sseClient = this.transports.get(session.id);
        if (sseClient) {
            logger.debug(`Forwarding message to SSE client endpoint: ${JSON.stringify(message)}`);
            sseClient.send(message);
        } else {
            logger.error('No SSE client transport found for session:', session.id);
        }
    }

    async closeSession(session: Session): Promise<void> {
        logger.debug('Closing SSE client endpoint for session:', session.id);
        const sseClient = this.transports.get(session.id);
        if (sseClient) {
            await sseClient.close();
            this.transports.delete(session.id);
        } else {
            logger.debug('No SSE client transport to close for session:', session.id);
        }
    }
}