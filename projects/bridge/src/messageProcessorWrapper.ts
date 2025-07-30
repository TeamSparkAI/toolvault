import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { MessageProcessor, AuthorizedMessageProcessor } from "./types/messageProcessor";

export class MessageProcessorWrapper implements AuthorizedMessageProcessor {
    private processor: MessageProcessor;

    constructor(processor: MessageProcessor) {
        this.processor = processor;
    }

    async authorize(serverName: string | null, authHeader: string): Promise<any> {
        if ('authorize' in this.processor) {
            return this.processor.authorize(serverName, authHeader);
        }
        // For BaseMessageProcessor, return undefined as auth payload
        return undefined;
    }

    async forwardMessageToServer(serverName: string | null, sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage | null> {
        if ('authorize' in this.processor) {
            return this.processor.forwardMessageToServer(serverName, sessionId, message, authPayload);
        }
        // For BaseMessageProcessor, ignore authPayload
        return this.processor.forwardMessageToServer(serverName, sessionId, message);
    }

    async returnMessageToClient(serverName: string | null, sessionId: string, message: JSONRPCMessage, authPayload: any): Promise<JSONRPCMessage | null> {
        if ('authorize' in this.processor) {
            return this.processor.returnMessageToClient(serverName, sessionId, message, authPayload);
        }
        // For BaseMessageProcessor, ignore authPayload
        return this.processor.returnMessageToClient(serverName, sessionId, message);
    }
}