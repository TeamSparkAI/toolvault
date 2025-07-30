import { ServerEndpointConfig } from "../types/config";
import { SessionManagerImpl } from "./sessionManager";
import { ServerEndpoint } from "./serverEndpoint";
import { ServerEndpointStdio } from "./serverEndpointStdio";
import { ServerEndpointSse } from "./serverEndpointSse";
import { ServerEndpointStreamable } from "./serverEndpointStreamable";

export function createServerEndpoint(config: ServerEndpointConfig, sessionManager: SessionManagerImpl): ServerEndpoint {
    let serverEndpoint: ServerEndpoint;
    switch (config.mode) {
        case 'stdio':
            serverEndpoint = new ServerEndpointStdio(config, sessionManager);
            break;
        case 'sse':
            serverEndpoint = new ServerEndpointSse(config, sessionManager);
            break;
        case 'streamable':
            serverEndpoint = new ServerEndpointStreamable(config, sessionManager);
            break;
        default:
            throw new Error(`Unknown server transport: ${config.mode}`);
    }
    return serverEndpoint;
}