import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export interface BaseMessageProcessor {
    forwardMessageToServer(serverName: string | null, sessionId: string, message: JSONRPCMessage): Promise<JSONRPCMessage | null>;
    returnMessageToClient(serverName: string | null, sessionId: string, message: JSONRPCMessage): Promise<JSONRPCMessage | null>;
}

export interface AuthorizedMessageProcessor {
    authorize(serverName: string | null, authHeader: string | null): Promise<any>;
    forwardMessageToServer(serverName: string | null, sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage | null> ;
    returnMessageToClient(serverName: string | null, sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage | null>;
}

export type MessageProcessor = BaseMessageProcessor | AuthorizedMessageProcessor;