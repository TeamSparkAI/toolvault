import { parseTree, ParseError, ParseOptions, applyEdits, modify, findNodeAtLocation, Node } from 'jsonc-parser';
import { ActionEvent, FieldModification, Finding, AppliedFieldModification, AppliedMessageReplacement } from '../types/core';
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
function findStringFieldPositions(ast: Node, fieldPaths: string[]): Map<string, StringFieldPosition> {
    const results = new Map<string, StringFieldPosition>();

    for (const fieldPath of fieldPaths) {
        // Convert dot notation path to JSONPath array
        const jsonPath = fieldPathToJsonPath(fieldPath);

        // Find the node at this path
        const node = findNodeAtLocation(ast, jsonPath);
        if (node && node.type === 'string') {
            results.set(fieldPath, {
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

function parseJsonToAst(messagePayloadString: string): Node {
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
    return ast;
 }

export interface ResolvedFinding extends Finding {
    resolvedStart: number;
    resolvedEnd: number;
}

/*
 * Resolve the start and end positions of findings based on the field paths and offsets in the AST
 */
export function resolveFindings(messagePayloadString: string, findings: Finding[]): ResolvedFinding[] {
    const ast = parseJsonToAst(messagePayloadString);

    const fieldFindingsByPath = new Map<string, Finding[]>();
    for (const finding of findings) {
        if (finding.location) {
            if (!fieldFindingsByPath.has(finding.location.fieldPath)) {
                fieldFindingsByPath.set(finding.location.fieldPath, []);
            }
            fieldFindingsByPath.get(finding.location.fieldPath)!.push(finding);
        }
    }
    const allFieldPaths = Array.from(fieldFindingsByPath.keys());
    const fieldOffsets = findStringFieldPositions(ast, allFieldPaths);

    const resolvedFindings: ResolvedFinding[] = [];
    for (const finding of findings) {
        if (finding.location) {
            const fieldOffset = fieldOffsets.get(finding.location.fieldPath);
            if (fieldOffset) {
                resolvedFindings.push({
                    ...finding,
                    resolvedStart: fieldOffset.startOffset + finding.location.start,
                    resolvedEnd: fieldOffset.startOffset + finding.location.end
                });
            }
        }
    }

    return resolvedFindings;
}

//
// NOTE: Everything below this is about applying modifications to a message payload
//

function applyActionEventsToField(fieldPath: string, fieldValue: string, actionEvents: ActionEvent[]) {
    // Replace contentModification FieldModification objects with AppliedFieldModification objects
    let resultText = fieldValue;

    // Filter to only events with field modifications and convert them to AppliedFieldModification
    const fieldModifications: AppliedFieldModification[] = [];
    for (const actionEvent of actionEvents) {
        if (actionEvent.contentModification?.type === 'field') {
            const fieldMod = actionEvent.contentModification as FieldModification;

            // Validate that the fieldPath matches
            if (fieldMod.fieldPath !== fieldPath) {
                console.warn(`Field path mismatch: expected ${fieldPath}, got ${fieldMod.fieldPath} from ActionEvent ${actionEvent.details}`);
                continue; // Skip this modification
            }

            const appliedMod: AppliedFieldModification = {
                ...fieldMod,
                applied: false,
                fieldResultStart: fieldMod.start,
                fieldResultEnd: fieldMod.end,
            };
            fieldModifications.push(appliedMod);

            // Replace the contentModification on the ActionEvent
            actionEvent.contentModification = appliedMod;
        }
    }

    if (fieldModifications.length === 0) {
        return {
            fieldPath,
            resultText,
            appliedModifications: []
        };
    }

    // Sort the modifications by start position
    fieldModifications.sort((a, b) => a.start - b.start);

    // Process the redaction modifications in order
    for (const mod of fieldModifications) {
        if (mod.action === 'redact') {
            let redactionStartChar = 'X';
            let redactionFillChar = 'X';
            let redactionEndChar = 'X';
            if (mod.actionText && mod.actionText.length === 1) {
                redactionStartChar = mod.actionText[0];
                redactionFillChar = redactionStartChar;
                redactionEndChar = redactionStartChar;
            } else if (mod.actionText && mod.actionText.length === 3) {
                redactionStartChar = mod.actionText[0];
                redactionFillChar = mod.actionText[1];
                redactionEndChar = mod.actionText[2];
            }
            const beforeMatch = resultText.substring(0, mod.start);
            const afterMatch = resultText.substring(mod.end);

            const matchLength = mod.end - mod.start;
            if (matchLength < 3) {
                // Replace each char of match with redaction char
                resultText = beforeMatch + redactionStartChar.repeat(matchLength) + afterMatch;
            } else {
                // Replace each char of match with redaction char
                resultText = beforeMatch + redactionStartChar + redactionFillChar.repeat(matchLength - 2) + redactionEndChar + afterMatch;
            }
            mod.applied = true;
        }
    }

    // Process the remove and replace modifications in order to remove the text and adjust the resultStart and resultEnd of all equal or later modifications
    for (const mod of fieldModifications) {
        if (mod.action === 'remove' || mod.action === 'replace') {
            const beforeMatch = resultText.substring(0, mod.fieldResultStart);
            const afterMatch = resultText.substring(mod.fieldResultEnd);
            resultText = beforeMatch + afterMatch;
            // Update the resultStart and resultEnd of all modifications to reflect the removed text
            const removedTextStart = mod.fieldResultStart;
            const removedTextLength = mod.fieldResultEnd - mod.fieldResultStart;
            for (const processMod of fieldModifications) {
                if (processMod.fieldResultStart > removedTextStart) {
                    processMod.fieldResultStart = Math.max(processMod.fieldResultStart - removedTextLength, removedTextStart);
                }
                if (processMod.fieldResultEnd > removedTextStart) {
                    processMod.fieldResultEnd = Math.max(processMod.fieldResultEnd - removedTextLength, removedTextStart);
                }
            }
            mod.applied = true;
        }
    }

    // Process the replace modifications in order to insert the replacement text
    for (const mod of fieldModifications) {
        if (mod.action === 'replace') {
            const beforeMatch = resultText.substring(0, mod.fieldResultStart);
            const afterMatch = resultText.substring(mod.fieldResultEnd);
            resultText = beforeMatch + (mod.actionText || '') + afterMatch;
            // Update the resultStart and resultEnd of all modifications to reflect the inserted text
            const insertedTextStart = mod.fieldResultStart;
            const insertedTextLength = (mod.actionText || '').length;
            mod.fieldResultEnd = mod.fieldResultStart + insertedTextLength;
            for (const processMod of fieldModifications) {
                if (processMod != mod) {
                    if (processMod.fieldResultStart >= insertedTextStart) {
                        processMod.fieldResultStart += insertedTextLength;
                    }
                    if (processMod.fieldResultEnd >= insertedTextStart) {
                        processMod.fieldResultEnd += insertedTextLength;
                    }
                }
            }
            mod.applied = true;
        }
    }

    return {
        fieldPath,
        resultText,
        appliedModifications: fieldModifications
    };
}

export function applyAllActionEventFieldMatches(messagePayloadString: string, events: ActionEvent[]): string {
    // Copy logic from below, but using ActionEvents (field matches will be applied in-place using applyActionEventsToField)
    // Compute json offsets and update them in the contentModification (which will be AppliedFieldModification objects)

    const ast = parseJsonToAst(messagePayloadString);
    
    // Group alerts by field path
    const fieldMatchGroups = new Map<string, ActionEvent[]>();
    for (const actionEvent of events) {
        if (actionEvent.contentModification?.type === 'field') {
            if (!fieldMatchGroups.has(actionEvent.contentModification?.fieldPath)) {
                fieldMatchGroups.set(actionEvent.contentModification?.fieldPath, []);
            }
            fieldMatchGroups.get(actionEvent.contentModification?.fieldPath)!.push(actionEvent);
        }
    }

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
        const appliedFieldMatches = applyActionEventsToField(fieldPath, fieldValue, fieldMatchGroups.get(fieldPath)!);
        // Replace the field in the message payload using jsonc
        const edits = modify(processedText, fieldPathToJsonPath(fieldPath), appliedFieldMatches.resultText, {});
        processedText = applyEdits(processedText, edits);
    }

    const processedAst = parseJsonToAst(processedText);

    const processedStringFieldPositions = findStringFieldPositions(processedAst, allFieldPaths);

    // Update json positions to use json object indexes instead of field indexes
    for (const event of events) {
        if (event.contentModification?.type === 'field') {
            const fieldMod = event.contentModification as AppliedFieldModification;
            const originalStringField = originalStringFieldPositions.get(fieldMod.fieldPath);
            const processedStringField = processedStringFieldPositions.get(fieldMod.fieldPath);
            if (originalStringField && processedStringField) {
                fieldMod.jsonOriginalStart = originalStringField.startOffset + fieldMod.fieldResultStart;
                fieldMod.jsonOriginalEnd = originalStringField.startOffset + fieldMod.fieldResultEnd;
                fieldMod.jsonResultStart = processedStringField.startOffset + fieldMod.fieldResultStart;
                fieldMod.jsonResultEnd = processedStringField.startOffset + fieldMod.fieldResultEnd;
            }
        }
    }

    return processedText;
}

export function applyModificationsToPayload(
    payload: any,
    origin: MessageOrigin,
    messageActions: MessageActionData[]
): { originalPayload: string, modifiedPayload: string | null } {
    const originalPayload = JSON.stringify(payload, null, 2);

    // Define wrapper type inline to maintain connection to original ActionEvents
    type ActionEventWrapper = {
        original: ActionEvent;
        policySeverity: number;
        elementClassName: string;
    };

    // Extract all content modifications from message actions
    const contentModifications: ActionEventWrapper[] = [];
    
    for (const messageAction of messageActions) {
        // Collect only actions for appropriate origin
        if (messageAction.origin !== origin) {
            continue;
        }
        // Collect only content modifications for coalescing
        const contentEvents = messageAction.actionEvents.filter(e => e.contentModification);
        contentModifications.push(...contentEvents.map((actionEvent: ActionEvent) => ({ 
            original: actionEvent,
            policySeverity: messageAction.severity,
            elementClassName: messageAction.action.elementClassName
        })));
    }

    const messageReplacements = contentModifications.filter(
        e => e.original.contentModification?.type === 'message'
    );
    const fieldModifications = contentModifications.filter(
        e => e.original.contentModification?.type === 'field'
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
        
        // Need to mark highest priority message replacement as applied
        highestPriority.original.contentModification = {
            ...highestPriority.original.contentModification,
            applied: true
        } as AppliedMessageReplacement;
        return { originalPayload, modifiedPayload: JSON.stringify(highestPriority.original.contentModification.payload, null, 2) };
    } else if (fieldModifications.length > 0) {            
        // Extract the original ActionEvents for field modifications
        const originalFieldModifications = fieldModifications.map(wrapper => wrapper.original);
        return { originalPayload, modifiedPayload: applyAllActionEventFieldMatches(originalPayload, originalFieldModifications) };
    }

    // No modifications, return original payload
    return { originalPayload, modifiedPayload: null };
}