export type PolicyAction = 'remove' | 'redact' | 'redactPattern' | 'replace' | 'none';

export interface PolicyData {
    policyId: number;
    name: string;
    description?: string;
    severity: number;
    origin: 'client' | 'server' | 'either';
    methods?: string[];
    filters: Array<{
        name: string;
        notes?: string;
        regex: string;
        keywords?: string[];
        validator?: 'none' | 'luhn';
    }>;
    action: PolicyAction;
    actionText?: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}