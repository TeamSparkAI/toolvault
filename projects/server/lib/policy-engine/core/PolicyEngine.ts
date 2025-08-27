import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { PolicyData } from "@/lib/models/types/policy";
import { Finding, ActionEvent, MessageReplacement, FieldModification } from "../types/core";
import { ConditionRegistry } from "../conditions/registry/ConditionRegistry";
import { ActionRegistry } from "../actions/registry/ActionRegistry";
import { PolicyContext } from "./PolicyContext";
import { PolicyEngineResult, PolicyFindings, ConditionFindings, PolicyActions, ActionResults, PolicyActionInstance, PolicyConditionInstance } from "./PolicyEngineResult";
import { applyAllFieldMatches } from "@/lib/utils/matches";

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
            
            // For now, we'll use the existing filter structure and convert to condition
            // TODO: Update when we implement new condition/action models
            if (policy.filters && policy.filters.length > 0) {
                const regexCondition = ConditionRegistry.getCondition('regex');
                if (regexCondition) {
                    // Convert existing filter structure to new format
                    for (const conditionConfig of policy.filters) {
                        const params = {
                            regex: conditionConfig.regex,
                            keywords: conditionConfig.keywords,
                            validator: conditionConfig.validator || 'none'
                        };
                        const findings = await regexCondition.applyCondition(message, null, params);

                        const conditionInstance: PolicyConditionInstance = {
                            conditionClassName: 'regex',
                            conditionConfigId: 1, // !!! Get from condition instance
                            conditionInstanceId: 0, // !!! Get from condition instance
                            conditionName: conditionConfig.name,
                            conditionParams: params
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
            
            // For now, we'll use the existing action structure
            // TODO: Update when we implement new condition/action models
            if (policy.action && policy.action !== 'none') {
                const rewriteAction = ActionRegistry.getAction('rewrite');
                if (rewriteAction) {
                    const params = {
                        action: policy.action,
                        actionText: policy.actionText
                    };
                    const events = await rewriteAction.applyAction(message, allFindings, null, params);

                    const actionInstance: PolicyActionInstance = {
                        actionClassName: 'rewrite',
                        actionConfigId: 1, //!!! Get from action instance
                        actionInstanceId: 0, // !!! Get from action instance
                        actionParams: params
                    };
                    
                    // Store all events in hierarchical structure
                    actionResults.push({
                        action: actionInstance,
                        actionEvents: events
                    });
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
            modifiedMessage: message, // Return original message, modifications applied separately
            policyFindings: policyFindings,
            policyActions: policyActions
        };
    }

    static applyModifications(
        originalMessage: JsonRpcMessageWrapper,
        policyActions: PolicyActions[]
    ): JsonRpcMessageWrapper {
        // Extract all content modifications from policy actions
        const contentModifications: (ActionEvent & { policySeverity: number })[] = [];
        
        for (const policyAction of policyActions) {
            for (const actionResult of policyAction.actionResults) {
                // Collect only content modifications for coalescing
                const contentEvents = actionResult.actionEvents.filter(e => e.contentModification);
                contentModifications.push(...contentEvents.map(e => ({ 
                    ...e, 
                    policySeverity: policyAction.policy.severity 
                })));
            }
        }

        // Check for message replacement actions (error, replace)
        const messageReplacements = contentModifications.filter(
            e => e.contentModification?.type === 'message'
        );

        if (messageReplacements.length > 0) {
            // Pick the highest priority one from the highest severity policy (lower severity = higher priority)
            const highestPriority = messageReplacements.reduce((highest, current) => {
                if (current.policySeverity < highest.policySeverity) return current;
                if (current.policySeverity === highest.policySeverity) {
                    // If same severity, error takes precedence over replace
                    if (current.actionClassName === 'error' && highest.actionClassName !== 'error') return current;
                    if (highest.actionClassName === 'error' && current.actionClassName !== 'error') return highest;
                    // If both same type, keep the first one
                }
                return highest;
            });
            
            const messageReplacement = highestPriority.contentModification as MessageReplacement;
            return messageReplacement.payload;
        } else {
            // No message replacement, handle field modifications
            const fieldModifications = contentModifications.filter(
                e => e.contentModification?.type === 'field'
            );

            if (fieldModifications.length > 0) {
                // Convert ActionEvents to the format expected by existing coalescing logic
                const fieldMatches = fieldModifications.map(event => {
                    const fieldMod = event.contentModification as FieldModification;
                    return {
                        fieldPath: fieldMod.fieldPath,
                        start: fieldMod.start,
                        end: fieldMod.end,
                        action: fieldMod.action,
                        actionText: fieldMod.actionText || '',
                        alertId: 0 // Not needed for coalescing
                    };
                });
                
                // Use existing coalescing logic
                const messagePayload = originalMessage.params || originalMessage.result;
                const messagePayloadString = JSON.stringify(messagePayload, null, 2);
                const appliedMatches = applyAllFieldMatches(messagePayloadString, fieldMatches);
                
                // Parse the result back to an object
                const resultPayload = JSON.parse(appliedMatches.resultText);
                
                // Determine payload type and return modified message
                if (originalMessage.origin === 'server' && originalMessage.messageId) {
                    return originalMessage.withPayload('result', resultPayload);
                } else {
                    return originalMessage.withPayload('params', resultPayload);
                }
            }
        }

        // No modifications, return original message
        return originalMessage;
    }
}