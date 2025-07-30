import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer, Server } from 'http';
import { ServerEndpointConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerEndpoint } from './serverEndpoint';
import { AuthorizedMessageProcessor } from '../types/messageProcessor';
import logger from '../logger';

export abstract class ServerEndpointHttpBase extends ServerEndpoint {
    protected server?: Server;
    public port: number = 0;

    // Abstract type field that derived classes must implement
    public abstract readonly type: 'sse' | 'streamable';

    constructor(config: ServerEndpointConfig, sessionManager: SessionManagerImpl) {
        super(config, sessionManager);
    }

    async start(messageProcessor?: AuthorizedMessageProcessor): Promise<void> {
        const host = this.config.host || 'localhost';
        const configPort = this.config.port || 0;

        logger.debug(`Starting ${this.type} server transport on port ${configPort}, preconfigured client endpoints: ${this.clientEndpoints.size}`);

        const app = express();
        this.server = createServer(app);
        app.use(cors({
            exposedHeaders: ['mcp-session-id', 'content-type', 'content-length']
          }));
        app.use(express.json());

        // Call the abstract method to set up routes
        await this.startAppRoutes(app, messageProcessor);

        // Wait for the server to start listening (and determine port) before resolving
        await new Promise<void>((resolve, reject) => {
            this.server!.listen(configPort, host, () => {
                const address = this.server!.address();
                if (address && typeof address === 'object' && 'port' in address) {
                    this.port = address.port;
                } else if (configPort !== 0) {
                    this.port = configPort;
                }
                logger.info(`Gateway server endpoint (${this.type}) listening on http://${host}:${this.port}`);
                resolve();
            });

            // Handle potential errors during server startup
            this.server!.on('error', (error) => {
                reject(error);
            });
        });
    }

    async stop(terminateProcess: boolean = true): Promise<void> {
        if (this.server) {
            logger.debug(`Shutting down ${this.type} server endpoint`);
            await new Promise<void>((resolve) => {
                this.server!.closeAllConnections();
                this.server!.close(() => {
                    logger.info(`${this.type} server endpoint shut down successfully`);
                    resolve();
                });
            });
        }
        await super.stop(terminateProcess);
    }

    /**
     * Abstract method that derived classes must implement to set up their specific routes
     * @param app The Express application instance
     * @param messageProcessor Optional message processor for handling messages
     */
    protected abstract startAppRoutes(app: express.Application, messageProcessor?: AuthorizedMessageProcessor): Promise<void>;
} 