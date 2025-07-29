import * as path from 'path';
import * as os from 'os';

// App data path:
// - MacOS: ~/Library/Application Support/ToolVault/
// - Linux: ~/.config/toolvault/
// - Windows: %APPDATA%\ToolVault\

/**
 * Get the application data directory path for the current OS
 * @returns The path to the app data directory
 */
export function getAppDataPath(): string {
    const platform = os.platform();

    if (platform === 'win32') {
        // Windows: %APPDATA%\ToolVault\
        return path.join(process.env.APPDATA || '', 'ToolVault');
    } else if (platform === 'darwin') {
        // macOS: ~/Library/Application Support/ToolVault/
        return path.join(os.homedir(), 'Library', 'Application Support', 'ToolVault');
    } else {
        // Linux and other Unix-like systems: ~/.config/toolvault/
        return path.join(os.homedir(), '.config', 'toolvault');
    }
}

/**
 * Get the api configuration file path
 * @returns The path to api.json
 */
export function getApiConfigPath(): string {
    return path.join(getAppDataPath(), 'api.json');
} 