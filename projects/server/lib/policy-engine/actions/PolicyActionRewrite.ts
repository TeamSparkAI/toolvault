import { PolicyActionBase } from "./PolicyActionBase";
import { JsonSchema, ValidationResult, Finding, ActionEvent, ContentModificationAction } from "../types/core";
import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";

export class PolicyActionRewrite extends PolicyActionBase {
    constructor() {
        super('rewrite', 'Message Modification', 'Replace, redact, or remove matched text');
    }

    get configSchema(): JsonSchema | null {
        return null;
    }

    get configValidator(): ((config: any) => ValidationResult) | null {
        return null;
    }

    get paramsSchema(): JsonSchema {
        return {
            properties: {
                action: {
                    type: 'string',
                    description: 'Type of modification to apply',
                    enum: ['remove', 'redact', 'redactPattern', 'replace'],
                    enumLabels: {
                        remove: 'Remove',
                        redact: 'Redact',
                        redactPattern: 'Redact Pattern',
                        replace: 'Replace'
                    },
                    required: true
                },
                actionText: {
                    type: 'string',
                    description: 'Text to use for redaction pattern or replacement',
                    required: false
                }
            }
        };
    }

    get paramsValidator(): ((params: any) => ValidationResult) | null {
        return (params: any): ValidationResult => {
            if (!params.action || !['remove', 'redact', 'redactPattern', 'replace'].includes(params.action)) {
                return {
                    isValid: false,
                    error: 'Action must be one of: remove, redact, redactPattern, replace'
                };
            }
            
            if (params.action === 'redactPattern' || params.action === 'replace') {
                if (!params.actionText || typeof params.actionText !== 'string') {
                    return {
                        isValid: false,
                        error: `Action text is required for ${params.action} action`
                    };
                }
                
                if (params.action === 'redactPattern' && params.actionText.length !== 1 && params.actionText.length !== 3) {
                    return {
                        isValid: false,
                        error: 'Redaction pattern must be 1 character (single char) or 3 characters (start, fill, end)'
                    };
                }
            }
            
            return { isValid: true };
        };
    }

    async applyAction(message: JsonRpcMessageWrapper, findings: Finding[], config: any, params: any): Promise<ActionEvent[]> {
        const events: ActionEvent[] = [];

        // Filter findings that have matches suitable for rewriting
        const findingsWithMatches = findings.filter(finding => finding.match);
        
        if (findingsWithMatches.length === 0) {
            return events; // No matches to rewrite
        }

        // Create action events for each finding with a match
        for (const finding of findingsWithMatches) {
            if (finding.match) {
                events.push({
                    type: 'rewrite',
                    params: params,
                    description: `Applied ${params.action} to: ${finding.details}`,
                    metadata: finding.metadata,
                    contentModification: {
                        type: 'field',
                        fieldPath: finding.match.fieldPath,
                        start: finding.match.start,
                        end: finding.match.end,
                        action: params.action as ContentModificationAction,
                        actionText: params.actionText
                    }
                });
            }
        }

        return events;
    }
}
