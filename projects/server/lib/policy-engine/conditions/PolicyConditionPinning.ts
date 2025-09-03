import { PolicyConditionBase, getStringFieldValues } from "./PolicyConditionBase";
import { JsonSchema, ValidationResult, Finding } from "../types/core";
import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { logger } from "@/lib/logging/server";
import { ModelFactory } from "@/lib/models";
import { deepEqual } from "@/lib/services/clientSyncService";
import { MessageData } from "@/lib/models/types/message";

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

    async applyCondition(
        messageData: MessageData,
        message: JsonRpcMessageWrapper, 
        config: any, 
        params: any
    ): Promise<Finding[]> {
        const serverModel = await ModelFactory.getInstance().getServerModel();
        const findings: Finding[] = [];
        const messagePayload = message['result'];

        if (messageData.origin === 'server') {
            if (messageData.payloadMethod === 'initialize' && params.validateMetadata) {
                const server = await serverModel.findById(messageData.serverId);
                if (server) {
                    const pinningInfo = server.pinningInfo;
                    if (pinningInfo) {
                        const initializeResponse = pinningInfo.mcpResponses.initialize;
                        if (initializeResponse) {
                            if (!deepEqual(messagePayload, initializeResponse)) {
                                findings.push({
                                    details: "Initialize response mismatch",
                                    match: false,
                                });
                            }
                        }
                    }
                }
            } else if (messageData.payloadMethod === 'tools/list' && params.validateTools) {
                const server = await serverModel.findById(messageData.serverId);
                if (server) {
                    const pinningInfo = server.pinningInfo;
                    if (pinningInfo) {
                        const toolsListResponse = pinningInfo.mcpResponses.toolsList;
                        if (toolsListResponse) {
                            if (!deepEqual(messagePayload, toolsListResponse)) {
                                findings.push({
                                    details: "Tools list response mismatch",
                                    match: false,
                                });
                            }
                        }
                    }
                }
            }
        }

        return findings;
    }
}