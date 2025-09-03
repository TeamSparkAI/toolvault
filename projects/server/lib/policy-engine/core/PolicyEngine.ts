import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { PolicyData } from "@/lib/models/types/policy";
import { ConditionRegistry } from "../conditions/registry/ConditionRegistry";
import { ActionRegistry } from "../actions/registry/ActionRegistry";
import { PolicyEngineResult, PolicyFindings, ConditionFindings, PolicyActions, PolicyActionInstance, PolicyConditionInstance } from "./PolicyEngineResult";
import { applyModificationsToPayload } from "../utils/messageModifications";
import { MessageActionData } from "@/lib/models/types/messageAction";
import { MessageData } from "@/lib/models/types/message";

export class PolicyEngine {
    static async processMessage(
        messageData: MessageData,
        message: JsonRpcMessageWrapper,
        policies: PolicyData[]
    ): Promise<PolicyEngineResult> {

        const policyFindings: PolicyFindings[] = [];
        const policyActions: PolicyActions[] = [];

        for (const policy of policies) {
            if (!policy.enabled) continue;
            
            // Get findings for all conditions
            const conditionFindings: ConditionFindings[] = [];
            
            if (policy.conditions && policy.conditions.length > 0) {
                for (const condition of policy.conditions) {
                    const conditionClass = ConditionRegistry.getCondition(condition.elementClassName);
                    if (conditionClass) {
                        const findings = await conditionClass.applyCondition(messageData, message, null, condition.params);
                        if (findings.length > 0) {
                            const conditionInstance: PolicyConditionInstance = {
                                elementClassName: condition.elementClassName,
                                elementConfigId: condition.elementConfigId,
                                instanceId: condition.instanceId,
                                name: condition.name,
                                params: condition.params
                            };
    
                            conditionFindings.push({
                                condition: conditionInstance,
                                findings: findings
                            });
                        }
                    }
                }
            }

            // If any findings for any condition, record all findings and apply actions to the findings
            if (conditionFindings.length > 0) {
                policyFindings.push({
                    policy: policy,
                    conditionFindings: conditionFindings
                });
                
                if (policy.actions && policy.actions.length > 0) {
                    for (const action of policy.actions) {
                        const actionClass = ActionRegistry.getAction(action.elementClassName);
                        if (actionClass) {
                            const events = await actionClass.applyAction(messageData, message, conditionFindings, null, action.params);
    
                            const actionInstance: PolicyActionInstance = {
                                elementClassName: action.elementClassName,
                                elementConfigId: action.elementConfigId,
                                instanceId: action.instanceId,
                                params: action.params
                            };
                            
                            // Store action with its events in flattened structure
                            policyActions.push({
                                policy: policy,
                                actionResults: [{
                                    action: actionInstance,
                                    actionEvents: events
                                }]
                            });
                        }
                    }
                }
            }
        }
        
        return {
            modifiedMessage: message, // Return original message, modifications to be applied separately
            policyFindings: policyFindings,
            policyActions: policyActions
        };
    }

    static applyModifications(
        originalMessage: JsonRpcMessageWrapper,
        messageActions: MessageActionData[]
    ): JsonRpcMessageWrapper {
        // Apply modifications to the appropriate payload based on message origin
        const origin = originalMessage.origin;
        const startingPayload = origin === 'client' ? originalMessage.params : originalMessage.result;
        
        const { modifiedPayload } = applyModificationsToPayload(startingPayload, origin, messageActions);
        
        if (modifiedPayload) {
            if (origin === 'client') {
                return originalMessage.withPayload('params', modifiedPayload);
            } else {
                return originalMessage.withPayload('result', modifiedPayload);
            }
        } else {
            return originalMessage;
        }
    }
}