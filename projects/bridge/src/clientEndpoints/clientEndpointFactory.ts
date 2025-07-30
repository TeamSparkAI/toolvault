import { ClientEndpoint } from "./clientEndpoint";
import { ClientEndpointSse } from "./clientEndpointSSE";
import { ClientEndpointStdio } from "./clientEndpointStdio";
import { ClientEndpoiontStreamable } from "./clientEndpointStreamable";
import { ClientEndpointConfig } from "../types/config";

export function createClientEndpoint(config: ClientEndpointConfig): ClientEndpoint {
    switch (config.mode) {
        case 'stdio':
            return new ClientEndpointStdio(config);
        case 'sse':
            return new ClientEndpointSse(config);
        case 'streamable':
            return new ClientEndpoiontStreamable(config);
        default:
            throw new Error(`Unsupported client mode: ${config.mode}`);
    }
}