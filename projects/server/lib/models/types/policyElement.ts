export type PolicyElementType = 'filter' | 'action';

export interface PolicyElementData {
    configId: number;
    className: string;
    elementType: PolicyElementType;
    config: any; // JSON object or null
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PolicyElementCreateData {
    className: string;
    elementType: PolicyElementType;
    config?: any;
    enabled?: boolean;
}

export interface PolicyElementUpdateData {
    config?: any;
    enabled?: boolean;
    // Note: className and elementType are immutable
}

export interface PolicyElementFilter {
    elementType?: PolicyElementType;
    enabled?: boolean;
}
