import { PolicyActionInstance } from "@/lib/policy-engine/core/PolicyEngineResult";
import { ActionEvent } from "@/lib/policy-engine/types/core";
import { MessageOrigin } from "@/lib/jsonrpc";

export interface MessageActionData {
    messageActionId: number;
    messageId: number;
    policyId: number;
    origin: MessageOrigin;
    severity: number;
    action: PolicyActionInstance;
    actionEvents: ActionEvent[];
    timestamp: string;
    createdAt: string;
}

// For fetching all actions for a message
export interface MessageActionsData {
    messageId: number;
    actions: MessageActionData[];
}
