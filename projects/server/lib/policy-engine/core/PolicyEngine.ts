import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { PolicyData } from "@/lib/models/types/policy";
import { Finding, ActionEvent, MessageReplacement, FieldModification } from "../types/core";
import { FilterRegistry } from "../filters/registry/FilterRegistry";
import { ActionRegistry } from "../actions/registry/ActionRegistry";
import { PolicyContext } from "./PolicyContext";
import { PolicyEngineResult, PolicyFindings, FilterFindings, PolicyActions, ActionResults } from "./PolicyEngineResult";
import { applyAllFieldMatches } from "@/lib/utils/matches";

export class PolicyEngine {
    static async processMessage(
        message: JsonRpcMessageWrapper,
        policies: PolicyData[],
        context?: PolicyContext
    ): Promise<PolicyEngineResult> {
        
        // Phase 1: Run all filters to collect findings in hierarchical structure
        const policyFindings: PolicyFindings[] = [];
        for (const policy of policies) {
            if (!policy.enabled) continue;
            
            const filterFindings: FilterFindings[] = [];
            
            // For now, we'll use the existing filter structure
            // TODO: Update when we implement new filter/action models
            if (policy.filters && policy.filters.length > 0) {
                const regexFilter = FilterRegistry.getFilter('regex');
                if (regexFilter) {
                    // Convert existing filter structure to new format
                    for (const filterConfig of policy.filters) {
                        const params = {
                            regex: filterConfig.regex,
                            keywords: filterConfig.keywords,
                            validator: filterConfig.validator || 'none'
                        };
                        const findings = await regexFilter.applyFilter(message, null, params);
                        
                        filterFindings.push({
                            filter: filterConfig,
                            findings: findings
                        });
                    }
                }
            }
            
            if (filterFindings.length > 0) {
                policyFindings.push({
                    policy: policy,
                    filterFindings: filterFindings
                });
            }
        }
        
        // Collect all findings for action processing
        const allFindings: Finding[] = [];
        for (const policyFinding of policyFindings) {
            for (const filterFinding of policyFinding.filterFindings) {
                allFindings.push(...filterFinding.findings);
            }
        }

        // Phase 2: Run all actions, collect content modifications in hierarchical structure
        const policyActions: PolicyActions[] = [];
        const contentModifications: (ActionEvent & { policySeverity: number })[] = [];
        
        for (const policy of policies) {
            if (!policy.enabled) continue;
            
            const actionResults: ActionResults[] = [];
            
            // For now, we'll use the existing action structure
            // TODO: Update when we implement new filter/action models
            if (policy.action && policy.action !== 'none') {
                const rewriteAction = ActionRegistry.getAction('rewrite');
                if (rewriteAction) {
                    const params = {
                        action: policy.action,
                        actionText: policy.actionText
                    };
                    const events = await rewriteAction.applyAction(message, allFindings, null, params);
                    
                    // Collect only content modifications for coalescing
                    const contentEvents = events.filter(e => e.contentModification);
                    contentModifications.push(...contentEvents.map(e => ({ 
                        ...e, 
                        policySeverity: policy.severity 
                    })));
                    
                    // Store all events in hierarchical structure
                    actionResults.push({
                        action: {
                            type: 'rewrite',
                            params: params
                        },
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

        // Phase 3: Reconcile content modifications
        let modifiedMessage = message;
        
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
                    if (current.type === 'error' && highest.type !== 'error') return current;
                    if (highest.type === 'error' && current.type !== 'error') return highest;
                    // If both same type, keep the first one
                }
                return highest;
            });
            
            const messageReplacement = highestPriority.contentModification as MessageReplacement;
            modifiedMessage = messageReplacement.payload;
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
                const messagePayload = message.params || message.result;
                const messagePayloadString = JSON.stringify(messagePayload, null, 2);
                const appliedMatches = applyAllFieldMatches(messagePayloadString, fieldMatches);
                
                // Parse the result back to an object
                const resultPayload = JSON.parse(appliedMatches.resultText);
                
                // Determine payload type and return modified message
                if (message.origin === 'server' && message.messageId) {
                    modifiedMessage = message.withPayload('result', resultPayload);
                } else {
                    modifiedMessage = message.withPayload('params', resultPayload);
                }
            }
        }

        return {
            modifiedMessage,
            policyFindings: policyFindings,
            policyActions: policyActions
        };
    }
}