import { PolicyActionBase } from "./PolicyActionBase";
import { JsonSchema, ValidationResult, Finding, ActionEvent } from "../types/core";
import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";

export class PolicyActionError extends PolicyActionBase {
    constructor() {
        super('error', 'Return Error', 'Return an MCP error response');
    }

    get configSchema(): JsonSchema | null { return null; }
    get configValidator(): ((config: any) => ValidationResult) | null { return null; }

    get paramsSchema(): JsonSchema {
        return {
            properties: {
                code: {
                    type: 'number',
                    description: 'MCP error code',
                    required: true
                },
                message: {
                    type: 'string',
                    description: 'Error message to return',
                    required: true
                }
            }
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

    async applyAction(message: JsonRpcMessageWrapper, findings: Finding[], config: any, params: any): Promise<ActionEvent[]> {
        return [{
            type: 'error',
            params: params,
            description: `Policy error: ${params.message}`,
            metadata: {
                findingsCount: findings.length,
                findings: findings.map(f => f.details)
            },
            contentModification: {
                type: 'message',
                payload: { error: { code: params.code, message: params.message } }
            }
        }];
    }
}
