import { PolicyActionBase } from "./PolicyActionBase";
import { JsonSchema, ValidationResult, FieldModificationAction, ActionEventWithConditionId } from "../types/core";
import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { ConditionFindings } from "../core";
import { MessageData } from "@/lib/models/types/message";

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
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    title: 'Action',
                    description: 'Type of modification to apply',
                    enum: ['remove', 'redact', 'redactPattern', 'replace'],
                    enumLabels: {
                        remove: 'Remove',
                        redact: 'Redact',
                        redactPattern: 'Redact Pattern',
                        replace: 'Replace'
                    }
                },
                actionText: {
                    type: 'string',
                    title: 'Action Text',
                    description: 'Text to use for redaction pattern or replacement'
                }
            },
            required: ['action']
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

    async applyAction(
        messageData: MessageData,
        message: JsonRpcMessageWrapper, 
        conditionFindings: ConditionFindings[], 
        config: any, 
        params: any
    ): Promise<ActionEventWithConditionId[]> {
        const events: ActionEventWithConditionId[] = [];

        const anyFindingsWithMatch = conditionFindings.some(conditionFinding => conditionFinding.findings.some(finding => finding.location));
        if (!anyFindingsWithMatch) {
            return events; // No matches to rewrite
        }

        for (const conditionFinding of conditionFindings) {
            for (const finding of conditionFinding.findings) {
                if (finding.match && finding.location) {
                    // We have this to add to our action event content
                    events.push({
                        details: `Applied ${params.action} to: ${finding.details}`,
                        metadata: finding.metadata,
                        contentModification: {
                            type: 'field',
                            fieldPath: finding.location.fieldPath, 
                            start: finding.location.start,
                            end: finding.location.end,
                            action: params.action as FieldModificationAction,
                            actionText: params.actionText,
                        },
                        conditionInstanceId: conditionFinding.condition.instanceId
                    });
                }
            }
        }

        return events;
    }
}
