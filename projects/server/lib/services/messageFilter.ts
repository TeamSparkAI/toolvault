import { ModelFactory } from '../models';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { JsonRpcMessageWrapper } from '@/lib/jsonrpc';
import { ProxyJwtPayload } from '../proxyJwt';
import { MessageData } from '@/lib/models/types/message';
import { FieldMatch } from '@/lib/models/types/alert';
import { applyAllFieldMatches, FieldMatchWithAlertId } from '../utils/matches';
import { logger } from '@/lib/logging/server';
import { PolicyEngine, PolicyContext, PolicyEngineResult } from '../policy-engine/core';

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
export async function applyPoliciesNew(messageData: MessageData, message: JsonRpcMessageWrapper, serverId: number): Promise<JsonRpcMessageWrapper> {
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

    // Build context (serverId from message)
    const context: PolicyContext = { 
        serverId: serverId
    };
    
    // Use new Policy Engine (static method)
    const result = await PolicyEngine.processMessage(message, applicablePolicies, context);

    // Create alerts from hierarchical findings
    const alertModel = await ModelFactory.getInstance().getAlertModel();
    for (const policyFinding of result.policyFindings) {
        for (const filterFinding of policyFinding.conditionFindings) {
            if (filterFinding.findings.length > 0) {
                // Convert findings to field matches for alert creation
                const fieldMatches: FieldMatch[] = filterFinding.findings
                    .filter(finding => finding.match) // Only findings with text matches
                    .map(finding => ({
                        fieldPath: finding.match!.fieldPath,
                        start: finding.match!.start,
                        end: finding.match!.end,
                        action: 'none', // Will be determined by policy actions
                        actionText: ''
                    }));
                
                if (fieldMatches.length > 0) {
                    await alertModel.create({
                        messageId: messageData.messageId,
                        timestamp: messageData.timestamp,
                        policyId: policyFinding.policy.policyId,
                        filterName: filterFinding.condition.name,
                        origin: message.origin,
                        matches: fieldMatches
                    });
                }
            }
        }
    }

    // Store message actions
    if (result.policyActions.length > 0) {
        const messageActionModel = await ModelFactory.getInstance().getMessageActionModel();
        
        await messageActionModel.create({
            messageId: messageData.messageId,
            actions: result.policyActions,
            timestamp: messageData.timestamp
        });
    }
    
    // Apply modifications separately
    const modifiedMessage = PolicyEngine.applyModifications(message, result.policyActions);
    
    return modifiedMessage;
}

/**
 * Apply policy filters to individual JSON string values using jsonc-parser
 */
async function applyPolicies(messageData: MessageData, message: JsonRpcMessageWrapper): Promise<JsonRpcMessageWrapper> {
    const policyModel = await ModelFactory.getInstance().getPolicyModel();
    const alertModel = await ModelFactory.getInstance().getAlertModel();

    const matches: FieldMatchWithAlertId[] = [];

    let payloadType: PayloadType = 'params';
    if (message.origin === 'server' && message.messageId) {
        // This is a server-to-client message with an ID, meaning it is a response to a previous client message
        payloadType = 'result';
    }

    const messagePayload = message[payloadType];

    // Find all string fields in the message payload
    const stringFields = getStringFieldValues(messagePayload);

    const policies = await policyModel.list();
    for (const policy of policies) {
        if (!policy.enabled) {
            continue;
        }

        if (policy.origin !== 'either' && policy.origin !== message.origin) {
            continue;
        }

        if (policy.methods && policy.methods.length > 0 && !policy.methods.includes(messageData.payloadMethod)) {
            continue;
        }

        const filters = policy.filters;
        for (const filter of filters) {
            const regex = new RegExp(filter.regex, 'g');

            const fieldMatches: FieldMatch[] = [];

            // Apply filters to each string field individually
            for (const stringField of stringFields) {
                let match: RegExpExecArray | null;
                while ((match = regex.exec(stringField.value)) !== null) {
                    let shouldCreateAlert = true;

                    // Apply keyword filters
                    if (filter.keywords && filter.keywords.length > 0) {
                        // Create a single regex that matches any of the keywords as complete words
                        const keywordPattern = `\\b(?:${filter.keywords.join('|')})\\b`;
                        const keywordRegex = new RegExp(keywordPattern, 'i');

                        // Create a window around the match in the string value
                        const windowStart = Math.max(0, match.index - KEYWORD_WINDOW_SIZE);
                        const windowEnd = Math.min(stringField.value.length, match.index + match[0].length + KEYWORD_WINDOW_SIZE);
                        const window = stringField.value.substring(windowStart, windowEnd);

                        shouldCreateAlert = keywordRegex.test(window);
                    }

                    // Apply validator
                    if (shouldCreateAlert && filter.validator === 'luhn') {
                        shouldCreateAlert = await isLuhnValid(match[0]);
                    }

                    if (shouldCreateAlert) {
                        fieldMatches.push({
                            fieldPath: stringField.path,
                            start: match.index,
                            end: match.index + match[0].length,
                            action: policy.action,
                            actionText: policy.actionText || ''
                        });
                    }
                }
            }

            // Process any field matches for this filter (create alert and add to matches for later application to the message payload)
            if (fieldMatches.length > 0) {
                const alert = await alertModel.create({
                    messageId: messageData.messageId,
                    timestamp: messageData.timestamp,
                    policyId: policy.policyId,
                    filterName: filter.name,
                    origin: message.origin,
                    matches: fieldMatches
                });
                matches.push(...fieldMatches.map(match => ({
                    ...match,
                    alertId: alert.alertId
                })));
            }
        }
    }

    // Apply matches to the original content
    if (matches.length > 0) {
        const messagePayloadString = JSON.stringify(messagePayload, null, 2);
        const appliedFieldMatches = applyAllFieldMatches(messagePayloadString, matches);
        const resultPayload = JSON.parse(appliedFieldMatches.resultText);
        message = message.withPayload(payloadType, resultPayload);
    }

    return message;
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
                        serverId: jwtPayload?.serverId || undefined,
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
                    serverId: jwtPayload?.serverId || undefined,
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