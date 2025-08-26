// Core types

export interface JsonSchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    name?: string; // Added back based on user feedback
    description?: string;
    default?: any;
    enum?: string[];
    enumLabels?: Record<string, string>; // Maps enum values to human-readable labels
    minimum?: number;
    maximum?: number;
    required?: boolean;
    items?: JsonSchemaProperty; // For arrays
    properties?: Record<string, JsonSchemaProperty>; // For objects
  }
  
  export interface JsonSchema {
    properties: Record<string, JsonSchemaProperty>;
  }

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

// Incident of data produced by policy filter
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
    type: 'log' | 'siem' | 'alert' | 'rewrite' | 'error' | 'replace';
    params: any;
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