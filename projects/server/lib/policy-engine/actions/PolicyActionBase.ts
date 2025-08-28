import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { PolicyElementBase } from "../core/PolicyElementBase";
import { Finding, ActionEvent } from "../types/core";
import { PolicyAction } from "@/lib/models/types/policy";

export abstract class PolicyActionBase extends PolicyElementBase {
    constructor(
        classId: string,
        name: string,
        description: string
    ) {
        super('action', classId, name, description);
    }

    abstract applyAction(message: JsonRpcMessageWrapper, findings: Finding[], config: any, action: PolicyAction): Promise<ActionEvent[]>;
}