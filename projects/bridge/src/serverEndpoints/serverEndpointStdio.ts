import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BaseSession } from './session';
import { ClientEndpoint } from '../clientEndpoints/clientEndpoint';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { ClientEndpointConfig, ServerEndpointConfig } from '../types/config';
import { SessionManagerImpl } from './sessionManager';
import { ServerEndpoint } from './serverEndpoint';
import { AuthorizedMessageProcessor, MessageProcessor } from '../types/messageProcessor';
import logger from '../logger';
import { createClientEndpoint } from '../clientEndpoints/clientEndpointFactory';

// Session class to manage stdio transport and message handling
export class StdioSession extends BaseSession<StdioServerTransport> {
    constructor(clientEndpoint: ClientEndpoint, messageProcessor?: AuthorizedMessageProcessor) {
        const transport = new StdioServerTransport();
        super(`stdio-${Date.now()}`, clientEndpoint, transport, 'Stdio', null, messageProcessor);
    }
}

export class ServerEndpointStdio extends ServerEndpoint {
    readonly type = 'stdio' as const;
    private session: StdioSession | null = null;

    constructor(config: ServerEndpointConfig, sessionManager: SessionManagerImpl) {
        super(config, sessionManager);
    }

    async addClientEndpoint(name: string, clientEndpoint: ClientEndpointConfig): Promise<void> {
        if (name === this.ONLY_CLIENT_ENDPOINT) {
            super.addClientEndpoint(name, clientEndpoint);
        } else {
            throw new Error(`Stdio server endpoint only supports a single client endpoint, failed to add client endpoint: ${name}`);
        }
    }

    // Update the client endpoint in place, including the session (if it exists) - only supported for stdio (which has a single session)
    async updateClientEndpoint(clientEndpoint: ClientEndpointConfig): Promise<void> {
        const newClientEndpoint = createClientEndpoint(clientEndpoint);
        this.clientEndpoints.set(this.ONLY_CLIENT_ENDPOINT, newClientEndpoint);
        if (this.session) {
            await this.session.updateClientEndpoint(newClientEndpoint);
        }
    }

    async start(messageProcessor?: AuthorizedMessageProcessor): Promise<void> {
        logger.debug('Starting stdio transport');

        const clientEndpoint = this.clientEndpoints.get(this.ONLY_CLIENT_ENDPOINT);
        if (!clientEndpoint ) {
            throw new Error('Stdio server endpoint has no client endpoints condfigured, failed to start');
        }

        if (this.session) {
            throw new Error('Stdio server endpoint already has a session, failed to start');
        }

        this.session = new StdioSession(clientEndpoint, messageProcessor);
        this.sessionManager.addSession(this.session);

        this.session.on('clientEndpointClose', () => {
            logger.debug('Client endpoint closed for stdio session:', this.session!.id);
            this.sessionManager.removeSession(this.session!.id);
        });

        const transport = this.session.transport;
        transport.onmessage = (message: JSONRPCMessage) => {
            logger.debug('Stdio server transport - received message', message);
            this.session?.forwardMessageToServer(message);
        };

        try {
            await this.session.start();
        } catch (error) {
            logger.error('Failed to start stdio transport:', error);
            process.exit(1);
        }
    }

    async stop(terminateProcess: boolean = true): Promise<void> {
        logger.debug('Stopping stdio transport');
        await super.stop(terminateProcess);
        process.stdout.end();
        process.stderr.end();
        process.stdin.end();
    }
}