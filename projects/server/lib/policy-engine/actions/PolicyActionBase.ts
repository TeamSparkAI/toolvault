import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { PolicyElementBase } from "../core/PolicyElementBase";
import { ActionEventWithConditionId } from "../types/core";
import { ConditionFindings, PolicyContext } from "../core";
import { PolicyAction } from "@/lib/models/types/policy";

export abstract class PolicyActionBase extends PolicyElementBase {
    constructor(
        classId: string,
        name: string,
        description: string
    ) {
        super('action', classId, name, description);
    }

    abstract applyAction(
        message: JsonRpcMessageWrapper, 
        conditionFindings: ConditionFindings[], 
        config: any, 
        params: any, 
        context: PolicyContext
    ): Promise<ActionEventWithConditionId[]>;
}