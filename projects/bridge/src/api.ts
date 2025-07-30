import { ClientEndpoint } from "./clientEndpoints/clientEndpoint";
import { ServerEndpoint } from "./serverEndpoints/serverEndpoint";
import { createServerEndpoint } from "./serverEndpoints/serverEndpointFactory";
import { SessionManagerImpl } from "./serverEndpoints/sessionManager";
import { ClientEndpointConfig, LogLevel, ServerEndpointConfig } from "./types/config";
import logger, { setLogLevel } from "./logger";
import { MessageProcessor } from "./types/messageProcessor";
import { MessageProcessorWrapper } from "./messageProcessorWrapper";
import { ClientEndpointLogEntry } from "./clientEndpoints/clientEndpoint";

export { ServerEndpoint, ClientEndpoint, ClientEndpointLogEntry };

export async function startBridge(server: ServerEndpointConfig, clients: ClientEndpointConfig[], messageProcessor?: MessageProcessor, logLevel?: LogLevel) : Promise<ServerEndpoint> {
    if (logLevel) {
        setLogLevel(logLevel);
        server.logLevel = logLevel;
    }

    logger.debug('Starting bridge in mode:', server.mode);

    const sessionManager = new SessionManagerImpl();

    const serverEndpoint = createServerEndpoint(server, sessionManager);

    if (clients.length == 1 && !clients[0].name) {
        serverEndpoint.setClientEndpoint(clients[0]);
    } else if (clients.length > 0) {
        for (const client of clients) {
            if (!client.name) {
                throw new Error('Client name is required for multiple clients');
            }
            serverEndpoint.addClientEndpoint(client.name!, client);
        }
    }

    await serverEndpoint.start(messageProcessor ? new MessageProcessorWrapper(messageProcessor) : undefined);

    return serverEndpoint;
}

export * from './types/config';
export * from './types/messageProcessor';