import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { Session } from "../serverEndpoints/session";
import { ClientEndpointConfig } from "../types/config";

export class ClientEndpointLogEntry {
    constructor(
        public readonly timestamp: Date,
        public readonly message: string) {}
}

export abstract class ClientEndpoint {
    protected config: ClientEndpointConfig;
    protected logEvents: ClientEndpointLogEntry[] = [];

    constructor(config: ClientEndpointConfig) {
        this.config = config;
    }

    abstract startSession(session: Session): Promise<void>;
    abstract sendMessage(session: Session, message: JSONRPCMessage): Promise<void>;
    abstract closeSession(session: Session): Promise<void>;

    protected logEvent(message: string) {
        this.logEvents.push(new ClientEndpointLogEntry(new Date(), message));
        if (this.logEvents.length > 100) {
            this.logEvents.shift();
        }
    }

    getConfig(): ClientEndpointConfig {
        return this.config;
    }

    getLogEvents(): ClientEndpointLogEntry[] {
        return this.logEvents;
    }
}