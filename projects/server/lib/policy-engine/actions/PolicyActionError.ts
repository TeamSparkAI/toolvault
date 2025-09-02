import { PolicyActionBase } from "./PolicyActionBase";
import { JsonSchema, ValidationResult, ActionEventWithConditionId } from "../types/core";
import { ConditionFindings, PolicyContext } from "../core";
import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { PolicyAction } from "@/lib/models/types/policy";

export class PolicyActionError extends PolicyActionBase {
    constructor() {
        super('error', 'Return Error', 'Return an MCP error response');
    }

    get configSchema(): JsonSchema | null { return null; }
    get configValidator(): ((config: any) => ValidationResult) | null { return null; }

    get paramsSchema(): JsonSchema {
        return {
            type: 'object',
            properties: {
                code: {
                    type: 'number',
                    title: 'Error Code',
                    description: 'MCP error code',
                    default: -32000
                },
                message: {
                    type: 'string',
                    title: 'Error Message',
                    description: 'Error message to return',
                    default: 'An error occurred'
                }
            },
            required: ['code', 'message']
        };
    }

    get paramsValidator(): ((params: any) => ValidationResult) | null {
        return (params: any): ValidationResult => {
            if (!params.code || typeof params.code !== 'number') {
                return {
                    isValid: false,
                    error: 'Error code is required and must be a number'
                };
            }
            
            if (!params.message || typeof params.message !== 'string') {
                return {
                    isValid: false,
                    error: 'Error message is required and must be a string'
                };
            }
            
            return { isValid: true };
        };
    }

    async applyAction(
        message: JsonRpcMessageWrapper, 
        conditionFindings: ConditionFindings[], 
        config: any, 
        params: any, 
        context: PolicyContext
    ): Promise<ActionEventWithConditionId[]> {
        return [{
            details: `Policy error: ${params.message}`,
            metadata: {
                findingsCount: conditionFindings.length // !!! This is really just an example of setting metadata for an action result
            },
            contentModification: {
                type: 'message',
                payload: { error: { code: params.code, message: params.message } }
            }
        }];
    }
}
