import { JsonRpcMessageWrapper } from '@/lib/jsonrpc';
import { FieldMatch } from '@/lib/models/types/alert';
import { MessageData } from '@/lib/models/types/message';
import { parseTree, ParseError, ParseOptions, applyEdits, modify, findNodeAtLocation, Node } from 'jsonc-parser';
import { ActionEvent, FieldModification, MessageReplacement } from '../types/core';
import { MessageActionData } from '@/lib/models/types/messageAction';
import { MessageOrigin } from '@/lib/jsonrpc';

/**
 * Convert a JSON field path in the form "field1.field2[0].field3" to a JSONPath array for jsonc-parser in the form ["field1", "field2", 0, "field3"]
 */
function fieldPathToJsonPath(fieldPath: string): (string | number)[] {
    const parts = fieldPath.split('.');
    const jsonPath: (string | number)[] = [];

    for (const part of parts) {
        // Handle array indices like "items[0]"
        const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
        if (arrayMatch) {
            jsonPath.push(arrayMatch[1]);
            jsonPath.push(parseInt(arrayMatch[2]));
        } else {
            jsonPath.push(part);
        }
    }

    return jsonPath;
}

interface StringFieldPosition {
    path: string;
    value: string;
    startOffset: number;
    endOffset: number;
}

/**
 * Find string field positions for specific paths using jsonc-parser
 */
function findStringFieldPositions(ast: Node, fieldPaths: string[]): StringFieldPosition[] {
    const results: StringFieldPosition[] = [];

    for (const fieldPath of fieldPaths) {
        // Convert dot notation path to JSONPath array
        const jsonPath = fieldPathToJsonPath(fieldPath);

        // Find the node at this path
        const node = findNodeAtLocation(ast, jsonPath);
        if (node && node.type === 'string') {
            results.push({
                path: fieldPath,
                value: node.value,
                startOffset: node.offset + 1, // Skip opening quote
                endOffset: node.offset + node.length - 1 // Skip closing quote
            });
        }
    }

    return results;
}

function getFieldValue(ast: Node, fieldPath: string): string | null {
    const jsonPath = fieldPathToJsonPath(fieldPath);
    const node = findNodeAtLocation(ast, jsonPath);
    if (node && node.type === 'string') {
        return node.value;
    }
    return null;
}

export interface AppliedFieldMatches {
    resultText: string;
    appliedMatches: AppliedMatchWithAlert[];
}

export interface AppliedMatchWithAlert extends AppliedFieldMatchWithAlert {
    fieldPath: string;
}

export interface AppliedFieldMatchesForField {
    fieldPath: string;
    resultText: string;
    appliedMatches: AppliedFieldMatchWithAlert[];
}

// Indiviual field match applied to a field (from an alert)
export interface AppliedFieldMatch {
    originalStart: number;
    originalEnd: number;
    resultStart: number;
    resultEnd: number;
    action: string;
    actionText: string;
}

// Indiviual field match applied to a field (from an alert)
export interface AppliedFieldMatchWithAlert extends AppliedFieldMatch {
    alertId?: number;
}

export interface FieldMatchWithAlertId extends FieldMatch {
    alertId?: number;
}

// !!! We should probably export this method and unit test it (with the unit tests serving as the docs).  This is the trickiest part
//     of the logic of handling overlapping matches (including more than two matches overlapping, all variations of overlap, etc).
//
function applyMatchesToField(fieldPath: string, fieldValue: string, matches: FieldMatchWithAlertId[]): AppliedFieldMatchesForField {
    let resultText = fieldValue;
    const appliedMatches: AppliedFieldMatchWithAlert[] = matches.map(match => ({
        alertId: match.alertId,
        originalStart: match.start,
        originalEnd: match.end,
        resultStart: match.start,
        resultEnd: match.end,
        action: match.action,
        actionText: match.actionText,
    }));
    // Sort the matches by start position
    appliedMatches.sort((a, b) => a.originalStart - b.originalStart);
    // Process the redaction matches in order
    for (const match of appliedMatches) {
        if (match.action === 'redact') {
            let redactionStartChar = 'X';
            let redactionFillChar = 'X';
            let redactionEndChar = 'X';
            if (match.actionText.length === 1) {
                redactionStartChar = match.actionText[0];
                redactionFillChar = redactionStartChar;
                redactionEndChar = redactionStartChar;
            } else if (match.actionText.length === 3) {
                redactionStartChar = match.actionText[0];
                redactionFillChar = match.actionText[1];
                redactionEndChar = match.actionText[2];
            }
            const beforeMatch = resultText.substring(0, match.originalStart);
            const afterMatch = resultText.substring(match.originalEnd);

            const matchLength = match.originalEnd - match.originalStart;
            if (matchLength < 3) {
                // Replace each char of match with redaction char
                resultText = beforeMatch + redactionStartChar.repeat(matchLength) + afterMatch;
            } else {
                // Replace each char of match with redaction char
                resultText = beforeMatch + redactionStartChar + redactionFillChar.repeat(matchLength - 2) + redactionEndChar + afterMatch;
            }
        }
    }
    // Process the remove and replace matches in order to remove the text and adjust the resultStart and resultEnd of all equal or later matches
    for (const match of appliedMatches) {
        if (match.action === 'remove' || match.action === 'replace') {
            const beforeMatch = resultText.substring(0, match.resultStart);
            const afterMatch = resultText.substring(match.resultEnd);
            resultText = beforeMatch + afterMatch;
            // Update the resultStart and resultEnd of all matches to reflect the removed text
            const removedTextStart = match.resultStart;
            const removedTextLength = match.resultEnd - match.resultStart;
            for (const processMatch of appliedMatches) {
                if (processMatch.resultStart > removedTextStart) {
                    processMatch.resultStart = Math.max(processMatch.resultStart - removedTextLength, removedTextStart);
                }
                if (processMatch.resultEnd > removedTextStart) {
                    processMatch.resultEnd = Math.max(processMatch.resultEnd - removedTextLength, removedTextStart);
                }
            }
        }
    }
    // Process the replace matches in order to insert the replacement text
    for (const match of appliedMatches) {
        if (match.action === 'replace') {
            const beforeMatch = resultText.substring(0, match.resultStart);
            const afterMatch = resultText.substring(match.resultEnd);
            resultText = beforeMatch + match.actionText + afterMatch;
            // Update the resultStart and resultEnd of all matches to reflect the inserted text
            const insertedTextStart = match.resultStart;
            const insertedTextLength = match.actionText.length;
            match.resultEnd = match.resultStart + match.actionText.length;
            for (const processMatch of appliedMatches) {
                if (processMatch != match) {
                    if (processMatch.resultStart >= insertedTextStart) {
                        processMatch.resultStart += insertedTextLength;
                    }
                    if (processMatch.resultEnd >= insertedTextStart) {
                        processMatch.resultEnd += insertedTextLength;
                    }
                }
            }
        }
    }
    return {
        fieldPath,
        resultText,
        appliedMatches
    };
}

// We use this function to apply all field matches to a message payload and get the resulting payload for the message processor output
//
// We also use this function to get the resutling text, along with the applied matches for each alert so that we can highlight the original
// match in the original text and the resulting match in the resulting text in the UI (typically by alert ID, which could be multiple matches)
//
// NOTE: The fact that we call this from both the front end and the back end makes logging complicated - we can't use either log (console) or logger (winston).
//
export function applyAllFieldMatches(messagePayloadString: string, fieldMatches: FieldMatchWithAlertId[]): AppliedFieldMatches {

    // Parse the JSON content using jsonc-parser
    const parseOptions: ParseOptions = {
        disallowComments: false,
        allowTrailingComma: true,
        allowEmptyContent: true,
    };
    const errors: ParseError[] = [];
    const ast = parseTree(messagePayloadString, errors, parseOptions);
    if (errors.length > 0) {
        throw new Error(`Failed to parse JSON for field matching: ${errors.map(e => e.error).join(', ')}`);
    }
    if (!ast) {
        throw new Error('Failed to parse JSON: parseTree returned undefined');
    }
    
    // Group field matches by field path to avoid duplicate edits
    const fieldMatchGroups = new Map<string, FieldMatchWithAlertId[]>();
    for (const fieldMatch of fieldMatches) {
        if (!fieldMatchGroups.has(fieldMatch.fieldPath)) {
            fieldMatchGroups.set(fieldMatch.fieldPath, []);
        }
        fieldMatchGroups.get(fieldMatch.fieldPath)!.push(fieldMatch);
    }

    const allAppliedFieldMatches: AppliedFieldMatchesForField[] = [];
    let processedText = messagePayloadString;

    const allFieldPaths = Array.from(fieldMatchGroups.keys());
    
    // Find string field positions for the paths we care about
    const originalStringFieldPositions = findStringFieldPositions(ast, allFieldPaths);

    // Apply changes for each field (we could just parse the json, make the changes by path, and output the json)
    for (const fieldPath of allFieldPaths) {
        // Get the value of the field
        const fieldValue = getFieldValue(ast, fieldPath);
        if (fieldValue === null) {
            // Skip fields that don't exist or aren't strings
            console.warn(`Field ${fieldPath} does not exist or is not a string`);
            continue;
        }
        // Apply the matches to the field
        const appliedFieldMatches = applyMatchesToField(fieldPath, fieldValue, fieldMatchGroups.get(fieldPath)!);
        // Replace the field in the message payload using jsonc
        const edits = modify(processedText, fieldPathToJsonPath(fieldPath), appliedFieldMatches.resultText, {});
        processedText = applyEdits(processedText, edits);
        allAppliedFieldMatches.push(appliedFieldMatches);
    }

    const processedAst = parseTree(processedText, errors, parseOptions);
    if (errors.length > 0) {
        throw new Error(`Failed to parse JSON for field matching: ${errors.map(e => e.error).join(', ')}`);
    }
    if (!processedAst) {
        throw new Error('Failed to parse processed JSON: parseTree returned undefined');
    }

    const processedStringFieldPositions = findStringFieldPositions(processedAst, allFieldPaths);

    // Update match positions to use json object indexes instead of field indexes
    for (const appliedFieldMatch of allAppliedFieldMatches) {
        const originalStringField = originalStringFieldPositions.find(field => field.path === appliedFieldMatch.fieldPath);
        const processedStringField = processedStringFieldPositions.find(field => field.path === appliedFieldMatch.fieldPath);
        if (originalStringField && processedStringField) {
            appliedFieldMatch.appliedMatches.forEach(match => {
                match.originalStart = originalStringField.startOffset + match.originalStart;
                match.originalEnd = originalStringField.startOffset + match.originalEnd;
                match.resultStart = processedStringField.startOffset + match.resultStart;
                match.resultEnd = processedStringField.startOffset + match.resultEnd;
            });
        }
    }

    return {
        resultText: processedText,
        appliedMatches: allAppliedFieldMatches.flatMap(fieldMatch => 
            fieldMatch.appliedMatches.map(match => ({
                fieldPath: fieldMatch.fieldPath,
                ...match
            }))
        )
    };
}

// Backward compatibility with old function

export interface AppliedMatch {
    originalStart: number;
    originalEnd: number;
    finalStart: number;
    finalEnd: number;
    action: string;
    actionText: string;
    alertId?: number;
}
  
export interface MatchResult {
    processedText: string;
    appliedMatches: AppliedMatch[];
}

export function applyMatchesFromAlerts(
    messagePayloadString: string,
    alerts: Array<{ alertId: number; matches: FieldMatch[] | null }>
): MatchResult {
    // Convert alerts param to FieldMatchWithAlertId[]
    const fieldMatches: FieldMatchWithAlertId[] = alerts.flatMap(alert => alert.matches?.map(match => ({
        ...match,
        alertId: alert.alertId
    })) || []);
    const appliedFieldMatches = applyAllFieldMatches(messagePayloadString, fieldMatches);
    // Convert appliedFieldMatches to MatchResult
    return {
        processedText: appliedFieldMatches.resultText,
        appliedMatches: appliedFieldMatches.appliedMatches.map(match => ({
            ...match,
            finalStart: match.resultStart,
            finalEnd: match.resultEnd
        }))
    };
}

// New function that applies modifications directly to a payload
export function applyModificationsToPayload(
    payload: any,
    origin: MessageOrigin,
    messageActions: MessageActionData[]
): { modifiedPayload: any; appliedMessageReplacement: ActionEvent | null } {
    // Extract all content modifications from message actions
    const contentModifications: (ActionEvent & { policySeverity: number, elementClassName: string })[] = [];
    
    for (const messageAction of messageActions) {
        for (const actionResult of messageAction.actionResults) {
            // Collect only content modifications for coalescing
            const contentEvents = actionResult.actionEvents.filter(e => e.contentModification);
            contentModifications.push(...contentEvents.map((e: ActionEvent) => ({ 
                ...e, 
                policySeverity: messageAction.severity,
                elementClassName: actionResult.action.elementClassName
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
                // If same severity, error takes precedence over replace (assuming we had a non-error message replace action someday)
                if (current.elementClassName === 'error' && highest.elementClassName !== 'error') return current;
                if (highest.elementClassName === 'error' && current.elementClassName !== 'error') return highest;
                // If both same type, keep the first one
            }
            return highest;
        });
        
        const messageReplacement = highestPriority.contentModification as MessageReplacement;
        return { modifiedPayload: messageReplacement.payload, appliedMessageReplacement: highestPriority };
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
                    alertId: undefined // Not needed for coalescing - !!! Remove this at some point?
                };
            });
            
            // Use existing coalescing logic
            const payloadString = JSON.stringify(payload, null, 2);
            const appliedMatches = applyAllFieldMatches(payloadString, fieldMatches);
            
            // Parse the result back to an object
            const resultPayload = JSON.parse(appliedMatches.resultText);
            
            return { modifiedPayload: resultPayload, appliedMessageReplacement: null };
        }
    }

    // No modifications, return original payload
    return { modifiedPayload: payload, appliedMessageReplacement: null };
}
