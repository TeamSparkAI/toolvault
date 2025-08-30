import { ActionResults } from "@/lib/policy-engine/core/PolicyEngineResult";
import { MessageOrigin } from "@/lib/jsonrpc";

export interface MessageActionData {
    messageId: number;
    policyId: number;
    alertId?: number;
    origin: MessageOrigin;
    severity: number;
    actionResults: ActionResults[];
    timestamp: string;
    createdAt: string;
}

// For fetching all actions for a message
export interface MessageActionsData {
    messageId: number;
    actions: MessageActionData[];
}
