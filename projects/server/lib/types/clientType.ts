import path from 'path';
import os from 'os';

// Core client type definition
export type ClientType = 'ttv' | 'vscode' | 'cursor' | 'claudecode' | 'roocode' | 'windsurf' | 'generic';

// Client type configuration
export class ClientTypeConfig {
    public readonly clientType: ClientType;
    public readonly globalDirectory?: string;
    public readonly globalFilename?: string;
    public readonly globalFileMcpKey?: string;
    public readonly mcpServersKey: string;
    public readonly projectConfigDirectory?: string;
    public readonly projectConfigFilename: string;

    constructor(
        clientType: ClientType,
        config: Partial<Omit<ClientTypeConfig, 'clientType'>> = {}
    ) {
        this.clientType = clientType;
        this.globalDirectory = config.globalDirectory;
        this.globalFilename = config.globalFilename;
        this.globalFileMcpKey = config.globalFileMcpKey;
        this.mcpServersKey = config.mcpServersKey || 'mcpServers';
        this.projectConfigDirectory = config.projectConfigDirectory;
        this.projectConfigFilename = config.projectConfigFilename || 'mcp.json';
    }
}

// Client type configurations
export const clientTypes: ClientTypeConfig[] = [
    new ClientTypeConfig('vscode', {
        globalDirectory: path.join(os.homedir(), '/Library/Application Support/Code/User'),
        globalFilename: 'mcp.json', // Changed from settings.json to mcp.json in v1.102+
        mcpServersKey: 'servers',
        projectConfigDirectory: '.vscode',
        projectConfigFilename: 'mcp.json',
    }),
    new ClientTypeConfig('cursor', {
        globalDirectory: path.join(os.homedir(), '.cursor'),
        globalFilename: 'mcp.json',
        globalFileMcpKey: 'mcpServers',
        projectConfigDirectory: '.cursor',
        projectConfigFilename: 'mcp.json',
    }),
    // This is tricky because there is not global directory indicating Claude Code, it's just a global file: ~/.claude.json
    new ClientTypeConfig('claudecode', {
        globalFilename: path.join(os.homedir(), '.claude.json'),
        projectConfigFilename: '.mcp.json',
    }),
    new ClientTypeConfig('windsurf', {
        projectConfigDirectory: '.windsurf',
        projectConfigFilename: 'mcp_config.json',
    }),
    new ClientTypeConfig('roocode', {
        projectConfigDirectory: '.roo',
    }),
    new ClientTypeConfig('generic'),
];

export function getClientTypeConfig(clientType: ClientType): ClientTypeConfig {
    return clientTypes.find(type => type.clientType === clientType)!;
}

export const clientTypeNames: Record<ClientType, string> = {
    ttv: 'Internal',
    vscode: 'VS Code',
    cursor: 'Cursor',
    claudecode: 'Claude Code',
    roocode: 'Roo Code',
    windsurf: 'Windsurf',
    generic: 'Generic'
};