import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { PolicyData } from "@/lib/models/types/policy";
import { Finding, ActionEvent, MessageReplacement, FieldModification } from "../types/core";
import { ConditionRegistry } from "../conditions/registry/ConditionRegistry";
import { ActionRegistry } from "../actions/registry/ActionRegistry";
import { PolicyContext } from "./PolicyContext";
import { PolicyEngineResult, PolicyFindings, ConditionFindings, PolicyActions, ActionResults, PolicyActionInstance, PolicyConditionInstance } from "./PolicyEngineResult";
import { applyModificationsFromActions } from "../utils/messageModifications";

export class PolicyEngine {
    static async processMessage(
        message: JsonRpcMessageWrapper,
        policies: PolicyData[],
        context?: PolicyContext
    ): Promise<PolicyEngineResult> {
        
        // Phase 1: Run all conditions to collect findings in hierarchical structure
        const policyFindings: PolicyFindings[] = [];
        for (const policy of policies) {
            if (!policy.enabled) continue;
            
            const conditionFindings: ConditionFindings[] = [];
            
            // Process conditions using the new condition/action system
            if (policy.conditions && policy.conditions.length > 0) {
                for (const condition of policy.conditions) {
                    const conditionClass = ConditionRegistry.getCondition(condition.elementClassName);
                    if (conditionClass) {
                        const findings = await conditionClass.applyCondition(message, null, condition.params);

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
            
            if (conditionFindings.length > 0) {
                policyFindings.push({
                    policy: policy,
                    conditionFindings: conditionFindings
                });
            }
        }
        
        // Collect all findings for action processing
        const allFindings: Finding[] = [];
        for (const policyFinding of policyFindings) {
            for (const conditionFinding of policyFinding.conditionFindings) {
                allFindings.push(...conditionFinding.findings);
            }
        }

        // Phase 2: Run all actions, collect action events in hierarchical structure
        const policyActions: PolicyActions[] = [];
        
        for (const policy of policies) {
            if (!policy.enabled) continue;
            
            const actionResults: ActionResults[] = [];
            
            // Process actions using the new condition/action system
            if (policy.actions && policy.actions.length > 0) {
                for (const action of policy.actions) {
                    const actionClass = ActionRegistry.getAction(action.elementClassName);
                    if (actionClass) {
                        const events = await actionClass.applyAction(message, allFindings, null, action);

                        const actionInstance: PolicyActionInstance = {
                            elementClassName: action.elementClassName,
                            elementConfigId: action.elementConfigId,
                            instanceId: action.instanceId,
                            params: action.params
                        };
                        
                        // Store all events in hierarchical structure
                        actionResults.push({
                            action: actionInstance,
                            actionEvents: events
                        });
                    }
                }
            }
            
            if (actionResults.length > 0) {
                policyActions.push({
                    policy: policy,
                    actionResults: actionResults
                });
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
        policyActions: PolicyActions[]
    ): JsonRpcMessageWrapper {
        const result = applyModificationsFromActions(originalMessage, policyActions);
        return result.modifiedMessage;
    }
}