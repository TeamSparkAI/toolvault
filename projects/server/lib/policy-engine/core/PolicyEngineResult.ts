import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { Finding, ActionEvent } from "../types/core";
import { PolicyData } from "@/lib/models/types/policy";

export interface PolicyEngineResult {
    modifiedMessage: JsonRpcMessageWrapper;
    policyFindings: PolicyFindings[];
    policyActions: PolicyActions[];
}

export interface PolicyFindings {
    policy: PolicyData;
    filterFindings: FilterFindings[];
}

export interface FilterFindings {
    filter: PolicyFilter;
    findings: Finding[];
}

// !!! We need to figure out how we're going to reference the filter (type and instance) and represent its params (generally, not like this)
export interface PolicyFilter {
    name: string;
    notes?: string;
    regex: string;
    keywords?: string[];
    validator?: 'none' | 'luhn';
}

export interface PolicyActions {
    policy: PolicyData;
    actionResults: ActionResults[];
}

export interface ActionResults {
    action: PolicyAction;
    actionEvents: ActionEvent[];
}

// !!! We need to figure out how we're going to reference the action (type and instance) and represent its params
export interface PolicyAction {
    type: string;
    params: any;
}
