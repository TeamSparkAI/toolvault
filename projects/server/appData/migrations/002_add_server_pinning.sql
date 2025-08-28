-- Add pinningInfo column to servers table for storing server pinning information
ALTER TABLE servers ADD COLUMN pinningInfo JSON;

-- Pass 1 - Prepare new policy schema for modular condition/action system

-- Add new conditons and actions columns to policies table
ALTER TABLE policies ADD COLUMN conditions JSON;
ALTER TABLE policies ADD COLUMN actions JSON;

-- Add new condition and findings columns to alerts table
ALTER TABLE alerts ADD COLUMN condition JSON;
ALTER TABLE alerts ADD COLUMN findings JSON;

-- Create message_actions table for storing actions taken on messages
CREATE TABLE message_actions (
    messageId INTEGER NOT NULL,
    actions JSON NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (messageId) REFERENCES messages(messageId) ON DELETE CASCADE
);

-- Create policy_elements table for installed conditionand action configurations
CREATE TABLE policy_elements (
    configId INTEGER PRIMARY KEY AUTOINCREMENT,
    className TEXT NOT NULL,
    elementType TEXT NOT NULL CHECK (elementType IN ('condition', 'action')),
    config JSON,
    enabled BOOLEAN DEFAULT 1,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default policy elements for built-in conditions and actions
INSERT INTO policy_elements (className, elementType)
VALUES 
    ('regex', 'condition'),
    ('rewrite', 'action'),
    ('error', 'action');

-- Create indexes for efficient querying
CREATE INDEX idx_message_actions_message_id ON message_actions(messageId);
CREATE INDEX idx_message_actions_created_at ON message_actions(createdAt);

CREATE INDEX idx_policy_elements_element_type ON policy_elements(elementType);
CREATE INDEX idx_policy_elements_class_name ON policy_elements(className);
CREATE INDEX idx_policy_elements_enabled ON policy_elements(enabled);

-- Create trigger for policy_elements updatedAt timestamp
CREATE TRIGGER update_policy_elements_timestamp 
AFTER UPDATE ON policy_elements
BEGIN
    UPDATE policy_elements SET updatedAt = CURRENT_TIMESTAMP
    WHERE configId = NEW.configId;
END;
