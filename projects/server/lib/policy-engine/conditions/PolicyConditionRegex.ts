import { PolicyConditionBase, getStringFieldValues } from "./PolicyConditionBase";
import { JsonSchema, ValidationResult, Finding } from "../types/core";
import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { logger } from "@/lib/logging/server";

const KEYWORD_WINDOW_SIZE = 100;

async function isLuhnValid(number: string): Promise<boolean> {
    // https://en.wikipedia.org/wiki/Luhn_algorithm
    const digits = number.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

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

    logger.debug(`Luhn check on ${number}: Sum: ${sum}, divisible by 10: ${sum % 10 === 0}`);
    return sum % 10 === 0;
}

export class RegexCondition extends PolicyConditionBase {
    constructor() {
        super('regex', 'Text Match', 'Match regular expressions in message text, with optional keyword and function validators');
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
                regex: {
                    type: 'string',
                    title: 'Match Pattern',
                    description: 'Regular expression pattern to match'
                },
                keywords: {
                    type: 'array',
                    title: 'Keywords',
                    description: 'Optional keywords that must be present near matches',
                    items: {
                        type: 'string'
                    }
                },
                validator: {
                    type: 'string',
                    title: 'Validator',
                    description: 'Validator function to apply to matches',
                    enum: ['none', 'luhn'],
                    default: 'none'
                }
            },
            required: ['regex']
        };
    }

    get paramsValidator(): ((params: any) => ValidationResult) | null {
        return (params: any): ValidationResult => {
            if (!params.regex || typeof params.regex !== 'string') {
                return {
                    isValid: false,
                    error: 'Regex pattern is required and must be a string'
                };
            }
            
            try {
                new RegExp(params.regex);
            } catch (error) {
                return {
                    isValid: false,
                    error: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`
                };
            }
            
            if (params.keywords && !Array.isArray(params.keywords)) {
                return {
                    isValid: false,
                    error: 'Keywords must be an array of strings'
                };
            }
            
            if (params.keywords && params.keywords.some((k: any) => typeof k !== 'string')) {
                return {
                    isValid: false,
                    error: 'All keywords must be strings'
                };
            }
            
            if (params.validator && !['none', 'luhn'].includes(params.validator)) {
                return {
                    isValid: false,
                    error: 'Validator must be either "none" or "luhn"'
                };
            }
            
            return { isValid: true };
        };
    }

    async applyCondition(message: JsonRpcMessageWrapper, config: any, params: any): Promise<Finding[]> {
        const findings: Finding[] = [];

        // Determine payload type
        let payloadType: 'params' | 'result' = 'params';
        if (message.origin === 'server' && message.messageId) {
            payloadType = 'result';
        }

        const messagePayload = message[payloadType];
        const stringFields = getStringFieldValues(messagePayload);
        const regex = new RegExp(params.regex, 'g');

        for (const stringField of stringFields) {
            let match: RegExpExecArray | null;
            while ((match = regex.exec(stringField.value)) !== null) {
                let shouldCreateAlert = true;

                // Apply keyword filters
                if (params.keywords && params.keywords.length > 0) {
                    const keywordPattern = `\\b(?:${params.keywords.join('|')})\\b`;
                    const keywordRegex = new RegExp(keywordPattern, 'i');

                    const windowStart = Math.max(0, match.index - KEYWORD_WINDOW_SIZE);
                    const windowEnd = Math.min(stringField.value.length, match.index + match[0].length + KEYWORD_WINDOW_SIZE);
                    const window = stringField.value.substring(windowStart, windowEnd);

                    shouldCreateAlert = keywordRegex.test(window);
                }

                // Apply validator
                if (shouldCreateAlert && params.validator === 'luhn') {
                    shouldCreateAlert = await isLuhnValid(match[0]);
                }

                if (shouldCreateAlert) {
                    // Create finding
                    const finding: Finding = {
                        details: `Regex match found: ${match[0]}`,
                        metadata: {
                            regex: params.regex,
                            keywords: params.keywords, // !!! It might be interesting to include the matching keywords in the finding
                            validator: params.validator
                        },
                        match: true, // This finding is suitable for text replacement/redaction actions
                        location: {
                            fieldPath: stringField.path,
                            start: match.index,
                            end: match.index + match[0].length
                        }
                    };
                    findings.push(finding);
                }
            }
        }

        return findings;
    }
}