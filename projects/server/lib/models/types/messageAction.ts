import { PolicyActions } from "@/lib/policy-engine/core/PolicyEngineResult";

export interface MessageActionData {
    messageId: number;
    actions: PolicyActions[];
    timestamp: string;
    createdAt: string;
}
