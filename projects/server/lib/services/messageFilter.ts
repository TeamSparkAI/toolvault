import { ModelFactory } from '../models';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { JsonRpcMessageWrapper } from '@/lib/jsonrpc';
import { ProxyJwtPayload } from '../proxyJwt';
import { MessageData } from '@/lib/models/types/message';
import { AlertReadData } from '@/lib/models/types/alert';
import { MessageActionData } from '@/lib/models/types/messageAction';
import { logger } from '@/lib/logging/server';
import { PolicyEngine } from '../policy-engine/core';

export interface MessageFilterResult {
    success: boolean;
    error?: string;
    message: JSONRPCMessage;
}

async function isLuhnValid(number: string): Promise<boolean> {
    // https://en.wikipedia.org/wiki/Luhn_algorithm
    // Remove any non-digit characters
    const digits = number.replace(/\D/g, '');

    let sum = 0;
    let isEven = false;

    // Process all digits including the check digit
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i]);
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        sum += digit;
        isEven = !isEven;
    }

    // If sum is divisible by 10, the number is valid
    logger.debug(`Luhn check on ${number}: Sum: ${sum}, divisible by 10: ${sum % 10 === 0}`);
    return sum % 10 === 0;
}

const KEYWORD_WINDOW_SIZE = 100;

type PayloadType = 'params' | 'result';

interface StringFieldValue {
    path: string;
    value: string;
}

function getStringFieldValues(obj: any, path: string = ''): StringFieldValue[] {
    const results: StringFieldValue[] = [];

    if (typeof obj === 'string') {
        results.push({ path, value: obj });
    } else if (typeof obj === 'object' && obj !== null) {
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                const itemPath = `${path}[${i}]`;
                results.push(...getStringFieldValues(obj[i], itemPath));
            }
        } else {
            for (const [key, value] of Object.entries(obj)) {
                const propertyPath = path ? `${path}.${key}` : key;
                results.push(...getStringFieldValues(value, propertyPath));
            }
        }
    }

    return results;
}

// New policy engine (get serverId from jwtPayload in caller)
//
export async function applyPolicies(messageData: MessageData, message: JsonRpcMessageWrapper): Promise<JsonRpcMessageWrapper> {
    const policyModel = await ModelFactory.getInstance().getPolicyModel();
    const policies = await policyModel.list();

    // Get enabled and applicable policies (based on enabled, origin, and methods)
    const applicablePolicies = policies.filter(policy => {
        if (!policy.enabled) {
            return false;
        }
        if (policy.origin !== 'either' && policy.origin !== message.origin) {
            return false;
        }
        if (policy.methods && policy.methods.length > 0 && !policy.methods.includes(messageData.payloadMethod)) {
            return false;
        }
        return true;
    });
    
    // Use new Policy Engine (static method)
    const result = await PolicyEngine.processMessage(messageData, message, applicablePolicies);

    // Create alerts from processMessage results (policy findings)

    // Map of alerts by condition instanceId
    const alertMap = new Map<string, AlertReadData>();

    const alertModel = await ModelFactory.getInstance().getAlertModel();
    for (const policyFinding of result.policyFindings) {
        for (const filterFinding of policyFinding.conditionFindings) {
            if (filterFinding.findings.length > 0) {
                const alert = await alertModel.create({
                    messageId: messageData.messageId,
                    timestamp: messageData.timestamp,
                    policyId: policyFinding.policy.policyId,
                    origin: message.origin,
                    condition: filterFinding.condition,
                    findings: filterFinding.findings,
                });
                alertMap.set(filterFinding.condition.instanceId, alert);
            }
        }
    }

    // Create message actions from processMessage results (policy actions)

    const messageActions: MessageActionData[] = [];
    const messageActionModel = await ModelFactory.getInstance().getMessageActionModel();
    for (const policyAction of result.policyActions) {
        let alertId: number | undefined = undefined;
        for (const actionResult of policyAction.actionResults) {
            for (const actionEvent of actionResult.actionEvents) {
                if (actionEvent.conditionInstanceId) {
                    actionEvent.alertId = alertMap.get(actionEvent.conditionInstanceId)?.alertId;
                }
            }
            const messageAction = await messageActionModel.create({
                messageId: messageData.messageId,
                policyId: policyAction.policy.policyId,
                origin: message.origin,
                severity: policyAction.policy.severity,
                action: actionResult.action,
                actionEvents: actionResult.actionEvents,
                timestamp: messageData.timestamp
            });
            messageActions.push(messageAction);    
        }
    }
    
    // Apply modifications and return the modified message
    const modifiedMessage = PolicyEngine.applyModifications(message, messageActions);
    
    return modifiedMessage;
}

export class MessageFilterService {
    /**
     * Process and store a JSON-RPC message using jsonc-parser for field-level filtering
     * @param jwtPayload The JWT payload containing user and client info
     * @param sessionId The session ID from the message processor
     * @param message The JSON-RPC message to process
     * @param timestamp Optional timestamp to use for the message record
     * @returns A result object containing the processed message and status
     */
    static async processMessage(
        jwtPayload: ProxyJwtPayload,
        sessionId: string,
        message: JsonRpcMessageWrapper,
        timestamp?: Date
    ): Promise<MessageFilterResult> {
        try {
            const messageModel = await ModelFactory.getInstance().getMessageModel();

            let messageData = null;
            if (message.origin === 'server' && message.messageId) {
                // This is a server-to-client message with an ID, meaning it is a response to a previous client message
                const messages = await messageModel.list(
                    {
                        serverId: jwtPayload.serverId,
                        sessionId,
                        payloadMessageId: message.messageId
                    },
                    { sort: 'desc', limit: 1 }
                );

                if (messages.messages.length > 0) {
                    // Update existing record with response data
                    messageData = await messageModel.update(messages.messages[0].messageId, {
                        payloadResult: message.result ?? undefined,
                        payloadError: message.errorMessage ? { code: message.errorCode, message: message.errorMessage } : undefined,
                        timestampResult: timestamp?.toISOString() || new Date().toISOString()
                    });
                } else {
                    // Server messages with an id but without a matching request found above is probably an error, but we'll just jam it in so we don't lose it
                    messageData = await messageModel.create({
                        timestamp: timestamp?.toISOString() || new Date().toISOString(),
                        origin: message.origin,
                        userId: jwtPayload?.user ?? 'unknown',
                        clientId: jwtPayload?.clientId || undefined,
                        sourceIP: jwtPayload?.sourceIp ?? 'unknown',
                        serverName: jwtPayload?.serverName || '',
                        serverId: jwtPayload.serverId,
                        sessionId,
                        payloadMessageId: message.messageId || '',
                        payloadMethod: message.method || '',
                        payloadToolName: '', // !!! Should this be undefined?
                        payloadParams: message.params || null,
                        payloadResult: message.result || null,
                        payloadError: message.errorMessage ? { code: message.errorCode, message: message.errorMessage } : null
                    });
                }
            } else {
                // New messages (either client-initiated, or server-initiated with no id)
                let payloadToolName = '';
                if (message.method === 'tools/call') {
                    payloadToolName = message.params?.name || ''; // !!! Should this be undefined?
                }
                messageData = await messageModel.create({
                    timestamp: timestamp?.toISOString() || new Date().toISOString(),
                    origin: message.origin,
                    userId: jwtPayload?.user ?? 'unknown',
                    clientId: jwtPayload?.clientId || undefined,
                    sourceIP: jwtPayload?.sourceIp ?? 'unknown',
                    serverName: jwtPayload?.serverName || '',
                    serverId: jwtPayload.serverId,
                    sessionId,
                    payloadMessageId: message.messageId || '',
                    payloadMethod: message.method || '',
                    payloadToolName: payloadToolName,
                    payloadParams: message.params || null,
                    payloadResult: null,
                    payloadError: null
                });
            }

            const filteredMessage = await applyPolicies(messageData, message);

            return {
                success: true,
                message: filteredMessage.toJSON()
            };
        } catch (error) {
            logger.error('Error storing message with jsonc filtering:', error);
            return {
                success: false,
                message: message.toJSON(),
                error: 'Failed to store message'
            };
        }
    }
} 