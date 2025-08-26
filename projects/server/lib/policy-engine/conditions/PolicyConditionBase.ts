import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { PolicyElementBase } from "../core/PolicyElementBase";
import { Finding } from "../types/core";

export interface StringFieldValue {
    path: string;
    value: string;
}

// Helper method to extract string values with JSON paths for a given object (usually a JSON RPC message payload)
//
export function getStringFieldValues(obj: any, path: string = ''): StringFieldValue[] {
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

export abstract class PolicyConditionBase extends PolicyElementBase {
    constructor(
        classId: string,
        name: string,
        description: string
    ) {
        super('condition', classId, name, description);
    }

    abstract applyCondition(message: JsonRpcMessageWrapper, config: any, params: any): Promise<Finding[]>
}