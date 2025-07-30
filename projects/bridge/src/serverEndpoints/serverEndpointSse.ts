import express, { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { ClientEndpoint } from '../clientEndpoints/clientEndpoint';
import { BaseSession, jsonRpcError } from './session';
import { ServerEndpointConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerEndpointHttpBase } from './serverEndpointHttpBase';
import { AuthorizedMessageProcessor, MessageProcessor } from '../types/messageProcessor';
import logger from '../logger';

// Session class to manage SSE transport and message handling
export class SseSession extends BaseSession<SSEServerTransport> {
    constructor(transport: SSEServerTransport, clientEndpoint: ClientEndpoint, serverName: string | null, messageProcessor?: AuthorizedMessageProcessor) {
        super(transport.sessionId || '', clientEndpoint, transport, 'SSE', serverName, messageProcessor);
    }
}

export class ServerEndpointSse extends ServerEndpointHttpBase {
    public readonly type = 'sse' as const;

    constructor(config: ServerEndpointConfig, sessionManager: SessionManagerImpl) {
        super(config, sessionManager);
    }

    private async handleSseRequest(req: Request, res: Response, serverName: string | null, clientEndpoint: ClientEndpoint, messageProcessor?: AuthorizedMessageProcessor, messagesPath: string = '/messages'): Promise<void> {
        const transport = new SSEServerTransport(messagesPath, res);
        logger.debug('Received SSE request, created new session:', transport.sessionId);
        
        const session = new SseSession(transport, clientEndpoint, serverName, messageProcessor);
        try {
            await session.authorize(req.headers['authorization'] || null);
        } catch (error) {
            logger.error('Error authorizing session:', error);
            res.status(401).json(jsonRpcError('Unauthorized: ' + error));
            return;
        }

        session.on('clientEndpointClose', () => {
            logger.debug('Client endpoint closed for SSE session:', session.id);
            this.sessionManager.removeSession(session.id);
        });

        this.sessionManager.addSession(session);
        await session.start();

        // Session close handler
        req.on('close', async () => {
            logger.debug('SSE connection closed for session ID:', transport.sessionId);
            const session = this.sessionManager.getSession(transport.sessionId!);
            if (session) {
                await session.close();
                this.sessionManager.removeSession(session.id);
            }
        });
    }

    private handleSessionRequest = async (req: Request, res: Response, serverName: string | null): Promise<void> => {
        logger.debug('SSE server transport - received message', req.url, req.body);

        // Extract sessionId from URL query params
        const url = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = url.searchParams.get('sessionId');
        
        if (!sessionId) {
            logger.error('No sessionId in request');
            res.status(400).send('No sessionId provided');
            return;
        }

        const session = this.sessionManager.getSession(sessionId);
        if (!session) {
            logger.error('No active session for sessionId:', sessionId);
            res.status(401).send('Auth failed, no active session');
            return;
        }

        if (session.serverName !== serverName) {
            logger.error('Session server name does not match request server name:', session.serverName, serverName);
            res.status(400).send('Session server name does not match request server name');
            return;
        }

        try {
            const message: JSONRPCMessage = {
                jsonrpc: req.body.jsonrpc,
                id: req.body.id,
                method: req.body.method,
                params: req.body.params
            };

            await session.forwardMessageToServer(message);
            res.status(202).send('Accepted').end();
        } catch (error) {
            logger.error('Error handling message:', error);
            res.status(500).send('Error handling message');
        }
    }

    protected async startAppRoutes(app: express.Application, messageProcessor?: AuthorizedMessageProcessor): Promise<void> {
        // Handle SSE endpoint based on client endpoint configuration
        if (this.clientEndpoints.size === 1 && this.clientEndpoints.has(this.ONLY_CLIENT_ENDPOINT)) {
            // Single client endpoint case - use /sse
            const clientEndpoint = this.clientEndpoints.get(this.ONLY_CLIENT_ENDPOINT)!;
            app.get('/sse', async (req: Request, res: Response) => {
                await this.handleSseRequest(req, res, null, clientEndpoint, messageProcessor);
            });
            app.post('/messages', async (req: Request, res: Response) => {
                await this.handleSessionRequest(req, res, null);
            });
        } else {
            // Multiple client endpoints case - use /:server/sse
            app.get('/:server/sse', async (req: Request, res: Response) => {
                const serverName = req.params.server;
                const clientEndpoint = this.clientEndpoints.get(serverName);
                
                if (!clientEndpoint) {
                    logger.error(`No client endpoint found for server: ${serverName}`);
                    res.status(404).json(jsonRpcError(`Server ${serverName} not found`));
                    return;
                }

                await this.handleSseRequest(req, res, serverName, clientEndpoint, messageProcessor, `/${serverName}/messages`);
            });
            app.post('/:server/messages', async (req: Request, res: Response) => {
                const serverName = req.params.server;
                const clientEndpoint = this.clientEndpoints.get(serverName);
                
                if (!clientEndpoint) {
                    logger.error(`No client endpoint found for server: ${serverName}`);
                    res.status(404).json(jsonRpcError(`Server ${serverName} not found`));
                    return;
                }

                await this.handleSessionRequest(req, res, serverName);
            });
        }
    }
}