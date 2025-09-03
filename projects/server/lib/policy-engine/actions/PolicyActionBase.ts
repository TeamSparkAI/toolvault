import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { PolicyElementBase } from "../core/PolicyElementBase";
import { ActionEventWithConditionId } from "../types/core";
import { MessageData } from "@/lib/models/types/message";
import { ConditionFindings } from "../core";

export abstract class PolicyActionBase extends PolicyElementBase {
    constructor(
        classId: string,
        name: string,
        description: string
    ) {
        super('action', classId, name, description);
    }

    abstract applyAction(
        messageData: MessageData,
        message: JsonRpcMessageWrapper, 
        conditionFindings: ConditionFindings[], 
        config: any, 
        params: any
    ): Promise<ActionEventWithConditionId[]>;
}