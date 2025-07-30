-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Create settings table
CREATE TABLE settings (
    settingsId INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,
    config JSON NOT NULL,
    description TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create servers table
CREATE TABLE servers (
    serverId INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    config JSON NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    security TEXT,
    serverCatalogId TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create clients table
CREATE TABLE clients (
    clientId INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    scope TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    configPath TEXT,
    autoUpdate BOOLEAN DEFAULT 0,
    enabled BOOLEAN DEFAULT 1,
    lastScanned TIMESTAMP,
    lastUpdated TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO clients (clientId, type, scope, name, description, token)
VALUES (
  1,
  'ttv',
  'global',
  'Tool Vault',
  'The TeamSpark MCP Tool Vault internal test client',
  '0AFD-0JMA-1VH8-1TR7'
);

-- Create client_servers table
CREATE TABLE client_servers (
    clientServerId INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId INTEGER NOT NULL,
    serverId INTEGER,
    clientServerName TEXT,
    toolNames JSON,
    syncState TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clientId) REFERENCES clients(clientId) ON DELETE CASCADE,
    FOREIGN KEY (serverId) REFERENCES servers(serverId) ON DELETE SET NULL,
    UNIQUE(clientId, serverId)
);

-- Create messages table
CREATE TABLE messages (
    messageId INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timestampResult TIMESTAMP,
    origin TEXT,
    userId TEXT,
    clientId INTEGER,
    sourceIP TEXT,
    serverId INTEGER,
    serverName TEXT,
    sessionId TEXT,
    payloadMessageId TEXT,
    payloadMethod TEXT,
    payloadToolName TEXT,
    payloadParams TEXT, -- JSON object
    payloadResult TEXT, -- JSON object
    payloadError TEXT, -- JSON object
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (serverId) REFERENCES servers(serverId) ON DELETE SET NULL,
    FOREIGN KEY (clientId) REFERENCES clients(clientId) ON DELETE SET NULL
);

-- Create policies table
CREATE TABLE policies (
    policyId INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    severity INTEGER NOT NULL,
    origin TEXT DEFAULT 'either',
    methods JSON,
    filters JSON NOT NULL,
    action TEXT DEFAULT 'none',
    actionText TEXT,
    enabled BOOLEAN DEFAULT 1,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create alerts table
CREATE TABLE alerts (
    alertId INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId INTEGER NOT NULL,
    policyId INTEGER NOT NULL,
    filterName TEXT NOT NULL,
    origin TEXT NOT NULL,
    matches JSON,
    timestamp TIMESTAMP NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seenAt TIMESTAMP,
    FOREIGN KEY (messageId) REFERENCES messages(messageId) ON DELETE CASCADE,
    FOREIGN KEY (policyId) REFERENCES policies(policyId) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX idx_messages_server_id ON messages(serverId);
CREATE INDEX idx_messages_client_id ON messages(clientId);
CREATE INDEX idx_messages_message_id ON messages(messageId);
CREATE INDEX idx_messages_session_id ON messages(sessionId);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_tool_name ON messages(payloadToolName);

-- Create indexes for alerts table
CREATE INDEX idx_alerts_message_id ON alerts(messageId);
CREATE INDEX idx_alerts_policy_id ON alerts(policyId);
CREATE INDEX idx_alerts_created_at ON alerts(createdAt);
CREATE INDEX idx_alerts_seen_at ON alerts(seenAt);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp);

-- Create indexes for client_servers table
CREATE INDEX idx_client_servers_client_id ON client_servers(clientId);
CREATE INDEX idx_client_servers_server_id ON client_servers(serverId);

-- Create index for server catalog ID
CREATE INDEX idx_servers_catalog_id ON servers(serverCatalogId);

-- Create triggers for updatedAt timestamps
CREATE TRIGGER update_settings_timestamp 
AFTER UPDATE ON settings
BEGIN
    UPDATE settings SET updatedAt = CURRENT_TIMESTAMP
    WHERE settingsId = NEW.settingsId;
END;

CREATE TRIGGER update_servers_timestamp 
AFTER UPDATE ON servers
BEGIN
    UPDATE servers SET updatedAt = CURRENT_TIMESTAMP
    WHERE serverId = NEW.serverId;
END;

CREATE TRIGGER update_clients_timestamp 
AFTER UPDATE ON clients
BEGIN
    UPDATE clients SET updatedAt = CURRENT_TIMESTAMP
    WHERE clientId = NEW.clientId;
END;

CREATE TRIGGER update_policies_timestamp 
AFTER UPDATE ON policies
BEGIN
    UPDATE policies SET updatedAt = CURRENT_TIMESTAMP
    WHERE policyId = NEW.policyId;
END;

CREATE TRIGGER update_client_servers_timestamp 
AFTER UPDATE ON client_servers
BEGIN
    UPDATE client_servers SET updatedAt = CURRENT_TIMESTAMP
    WHERE clientServerId = NEW.clientServerId;
END; 