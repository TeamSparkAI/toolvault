import { JsonSchema } from "../types/core";

export type PolicyElementType = 'condition' | 'action';

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export abstract class PolicyElementBase {
    constructor(
        private readonly _type: PolicyElementType,
        private readonly _classId: string,
        private readonly _name: string,
        private readonly _description: string
    ) {}

    get type(): PolicyElementType {
        return this._type;
    }

    get classId(): string {
        return this._classId;
    }

    get name(): string {
        return this._name;
    }

    get description(): string {
        return this._description;
    }

    abstract get configSchema(): JsonSchema | null;
    abstract get configValidator(): ((config: any) => ValidationResult) | null;
    abstract get paramsSchema(): JsonSchema;
    abstract get paramsValidator(): ((params: any) => ValidationResult) | null;
}

export interface PolicyElementModel {
    type: PolicyElementType;
    classId: string;
    instanceId: string;
    config: any;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
