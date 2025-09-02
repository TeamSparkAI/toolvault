// How conditions are stored in the policy
export interface PolicyCondition {
    elementClassName: string;  // e.g., "regex"
    elementConfigId: number;   // references policy_elements table
    instanceId: string;        // instance of condition in policy (random base32 id)
    name: string;              // display name
    notes?: string;            // optional description
    params: any;               // configuration
}

// How actions are stored in the policy  
export interface PolicyAction {
    elementClassName: string;  // e.g., "rewrite"
    elementConfigId: number;   // references policy_elements table
    instanceId: string;        // instance of action in policy (random base32 id)
    params: any;               // configuration
}

export interface PolicyData {
    policyId: number;
    name: string;
    description?: string;
    severity: number;
    origin: 'client' | 'server' | 'either';
    methods?: string[];
    conditions: PolicyCondition[];
    actions: PolicyAction[];
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}