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

// VS Code settings.json location
//   Per: https://code.visualstudio.com/docs/configure/settings#_settings-file-locations
//
// User settings.json location:
//
// Windows %APPDATA%\Code\User\settings.json
// macOS $HOME/Library/Application\ Support/Code/User/settings.json
// Linux $HOME/.config/Code/User/settings.json
// 
const vscodeGlobalDirectory = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User')
    : process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'Code', 'User')
    : path.join(os.homedir(), '.config', 'Code', 'User');

// Client type configurations
export const clientTypes: ClientTypeConfig[] = [
    new ClientTypeConfig('vscode', {
        globalDirectory: vscodeGlobalDirectory,
        globalFilename: 'mcp.json', // Changed from settings.json to mcp.json in v1.102+
        mcpServersKey: 'servers',
        projectConfigDirectory: '.vscode',
        projectConfigFilename: 'mcp.json',
    }),
    new ClientTypeConfig('cursor', {
        globalDirectory: path.join(os.homedir(), '.cursor'), // Windows uses %USERPROFILE%, which is the same as os.homedir(), so this should work on all platforms
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
        globalDirectory: path.join(os.homedir(), '.codeium', 'windsurf'),
        globalFilename: 'mcp_config.json',
        projectConfigDirectory: '.windsurf',
        projectConfigFilename: 'mcp_config.json',
    }),
    new ClientTypeConfig('roocode', {
        globalDirectory: path.join(vscodeGlobalDirectory, 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings'),
        globalFilename: 'mcp_settings.json',
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