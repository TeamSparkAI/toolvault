import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { Finding, ActionEvent } from "../types/core";
import { PolicyData } from "@/lib/models/types/policy";

export interface PolicyEngineResult {
    modifiedMessage: JsonRpcMessageWrapper;
    policyFindings: PolicyFindings[];
    policyActions: PolicyActions[];
}

// A collection of findings grouped by policy
export interface PolicyFindings {
    policy: PolicyData; // !!! Do we need this, or is policyId sufficient?  What if policy has changed or been deleted?
    conditionFindings: ConditionFindings[];
}

// A collection of findings grouped by condition
export interface ConditionFindings {
    condition: PolicyConditionInstance;
    findings: Finding[];
}

// Defines the policy condition (the instance on the policy) that generated a finding
export interface PolicyConditionInstance {
    elementClassName: string;
    elementConfigId: number;
    instanceId: string; // This is the instance of the condition in the policy
    // The instanceId refers to the instance of the condition in the policy, but it could be edited or removed, so we store
    // the below fields to record the state of the condition instance at the time of the policy run
    name: string;
    params: any;
}

// A collection of actions results grouped by policy (only used to return actions from policy engine, not stored anywhere)
export interface PolicyActions {
    policy: PolicyData; // !!! Do we need this, or is policyId sufficient?  What if policy has changed or been deleted?
    actionResults: ActionResults[];
}

// A collection of actions resulting from a given policy action
export interface ActionResults {
    action: PolicyActionInstance;
    actionEvents: ActionEvent[];
}

// Defines the policy action (the instance on the policy) that triggered the resilts
export interface PolicyActionInstance {
    elementClassName: string;
    elementConfigId: number;
    instanceId: string; // The is the instance of the action in the policy
    params: any;
}