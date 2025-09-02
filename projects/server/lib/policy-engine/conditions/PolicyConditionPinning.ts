import { PolicyConditionBase, getStringFieldValues } from "./PolicyConditionBase";
import { JsonSchema, ValidationResult, Finding } from "../types/core";
import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { logger } from "@/lib/logging/server";
import { PolicyContext } from "../core/PolicyContext";

export class PinningCondition extends PolicyConditionBase {
    constructor() {
        super('pinning', 'Pinning', 'Validate server behavior matches pinned server behavior');
    }

    get configSchema(): JsonSchema | null {
        return null;
    }

    get configValidator(): ((config: any) => ValidationResult) | null {
        return null;
    }

    get paramsSchema(): JsonSchema {
        return {
            type: 'object',
            properties: {
                validateMetadata: {
                    type: 'boolean',
                    title: 'Validate Metadata',
                    description: 'Validate metadata of the server',
                    default: true
                },
                validateTools: {
                    type: 'boolean',
                    title: 'Validate Tools',
                    description: 'Validate tool list and descriptions of the server',
                    default: true
                },
            },
            required: ['regex']
        };
    }

    get paramsValidator(): ((params: any) => ValidationResult) | null {
        return null;
    }

    // !!! We're gonna need some context here (for things like serverId, probably JWT payload, etc)
    async applyCondition(
        message: JsonRpcMessageWrapper, 
        config: any, 
        params: any,
        context: PolicyContext
    ): Promise<Finding[]> {
        const findings: Finding[] = [];

        // Determine payload type
        let payloadType: 'params' | 'result' = 'params';
        if (message.origin === 'server' && message.messageId) {
            payloadType = 'result';
        }

        const messagePayload = message[payloadType];

        // !!! Do the magic here!
        logger.info(`Pinning condition applied to ${payloadType} message`);

        return findings;
    }
}