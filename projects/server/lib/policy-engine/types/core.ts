// Core types
import { PolicyAction } from "@/lib/models/types/policy";

export interface JsonSchema {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    title?: string; // Display name for the field
    description?: string;
    default?: any;
    enum?: string[];
    enumLabels?: Record<string, string>; // Maps enum values to human-readable labels
    format?: string; // For string formatting (e.g., 'multiline', 'email', 'uri')
    minimum?: number;
    maximum?: number;
    multipleOf?: number; // For number step validation
    required?: string[]; // Array of required property names (JSON Schema standard)
    items?: JsonSchema; // For arrays
    properties?: Record<string, JsonSchema>; // For objects
  }

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

// Incident of data produced by policy condition
export interface Finding {
    details: string;
    metadata?: any;
    // !!! Maybe we rename "match" to "location" and add a bool for "textMatch" (suitable for item replacement, redaction, etc)
    match?: {
        fieldPath: string;
        start: number;
        end: number;
    };
}

// Content modification action types (shared between actions and events)
export type ContentModificationAction = 'remove' | 'redact' | 'redactPattern' | 'replace';

// Action event types for policy engine
export interface ActionEvent {
    action: PolicyAction; // The policy action that triggered this event
    description: string;
    metadata?: any;
    contentModification?: ContentModification;
}

export type ContentModification = 
  | FieldModification
  | MessageReplacement;

export interface FieldModification {
    type: 'field';
    fieldPath: string;
    start: number;
    end: number;
    action: ContentModificationAction;
    actionText?: string;
}

export interface MessageReplacement {
    type: 'message';
    payload: any;
}