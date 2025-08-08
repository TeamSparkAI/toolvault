import * as fs from 'fs/promises';
import { McpServerConfig } from '../types/server';
import { applyEdits, EditResult, JSONPath, ModificationOptions, modify, parse, ParseError, ParseOptions } from 'jsonc-parser';
import { fileExists } from '../utils/fs';
import { logger } from '@/lib/logging/server';

// NOTE: Many of our client config files are files that are meant to be edited by humans.  Humans are terrible at writing valid JSON.
//       It is common to use Javascript-style comments, trailing commas, and other non-standard JSON features when hand-editing "JSON".
//       To deal with this, VS Code (specifically) uses a custom JSON parser (jsonc-parser) that allows for these non-standard features, 
//       and even preserves them when writing back to the file.
//
//       This service is designed to work with these non-standard JSON files, and preserve the non-standard features when writing back
//       to the file (leveraging jsonc-parser).  At worst, our support should be comparable to VS Code itself (which is the basis for
//       a large number of the client tools we support).
//

export interface McpConfigFileOptions {
    filePath: string;
    fileMustExist?: boolean; // If false, you may make mods and write the file even if it didn't exist on load
    mcpConfig?: string; // Optional key for nested MCP config (e.g., "mcp" for VS Code settings.json)
    mcpServers?: string; // Optional key for servers object, defaults to "mcpServers"
}

function jsoncParse(content: string): any {
    const parseOptions: ParseOptions = {
        disallowComments: false,
        allowTrailingComma: true,
        allowEmptyContent: true,
    };
    const errors: ParseError[] = [];
    const json = parse(content, errors, parseOptions);
    if (errors.length > 0) {
        throw new Error(`Failed to parse config file ${content}: ${errors.map(e => e.error).join(', ')}`);
    }
    return json;
}

export class McpConfigFileService {
    private filePath: string;
    private fileMustExist: boolean;
    private mcpConfig?: string;
    private mcpServers: string;
    private config: any;
    private originalContent: string = '';
    private currentContent: string = '';
    private indent: number = 2;

    constructor(options: McpConfigFileOptions) {
        this.filePath = options.filePath;
        this.fileMustExist = options.fileMustExist ?? true;
        this.mcpConfig = options.mcpConfig;
        this.mcpServers = options.mcpServers || 'mcpServers';
    }

    /**
     * Load the JSON config file and parse it
     * @returns The parsed JSON object
     */
    async load(): Promise<any> {
        const configFileExists = await fileExists(this.filePath);
        if (this.fileMustExist && !configFileExists) {
            logger.debug(`Config file is required, but does not exist: ${this.filePath}`);
            throw new Error(`Config file does not exist: ${this.filePath}`);
        }
        if (!configFileExists) {
            this.originalContent = '';
            this.config = {};
            this.currentContent = '{}';
            return this.config;
        }

        try {
            this.originalContent = await fs.readFile(this.filePath, 'utf8');
            this.currentContent = this.originalContent;
            // Look for first newline followed by whitepsace followed by an open brace, square bracket, or string- the amount of whitespace is the indent
            const indentMatch = this.originalContent.match(/\n(\s*)(\{|\[|")/);
            if (indentMatch) {
                this.indent = Math.min(indentMatch[1].length, 8);
            }
            this.config = jsoncParse(this.originalContent);
            return this.config;
        } catch (error) {
            throw new Error(`Config file does not exist or is invalid: ${this.filePath}`);
        }
    }

    /**
     * Get the MCP servers object from the config
     * @returns The mcpServers object
     */
    getMcpServers(): any {
        if (this.mcpConfig) {
            // For nested configs like VS Code settings.json
            return this.config[this.mcpConfig]?.[this.mcpServers];
        } else {
            // For direct configs like mcp.json
            return this.config[this.mcpServers];
        }
    }

    private getMcpConfigPath(serverName: string, attributeName?: string): JSONPath {
        if (this.mcpConfig) {
            const path = [this.mcpConfig, this.mcpServers, serverName];
            return attributeName ? [...path, attributeName] : path;
        } else {
            const path = [this.mcpServers, serverName];
            return attributeName ? [...path, attributeName] : path;
        }
    }

    private applyModification(path: JSONPath, value: any): void {
        const options: ModificationOptions = {
            formattingOptions: {
                tabSize: this.indent,
                insertSpaces: true,
                keepLines: true,
            }
        };
    
        this.currentContent = applyEdits(this.currentContent, modify(this.currentContent, path, value, options));
    }

    /**
     * Add a server configuration
     * @param serverName The name of the server
     * @param config The server configuration
     */
    addServer(serverName: string, config: McpServerConfig): void {
        const newServer: any = {
            type: config.type
        }
        if (config.type === 'stdio') {
            newServer.command = config.command;
            if (config.args) newServer.args = config.args;
            if (config.env) newServer.env = config.env;
            if (config.cwd) newServer.cwd = config.cwd;
        } else if (config.type === 'sse' || config.type === 'streamable') {
            newServer.url = config.url;
            if (config.headers) newServer.headers = config.headers;
        }

        this.applyModification(this.getMcpConfigPath(serverName), newServer);
    }

    /**
     * Update a server configuration
     * @param serverName The name of the server
     * @param config The new server configuration
     */
    updateServer(serverName: string, newConfig: McpServerConfig): void {
        const currentConfig = this.getMcpServers()[serverName];
        if (!currentConfig) {
            throw new Error(`Server ${serverName} not found in config file ${this.filePath}`);
        }

        // The goal here is to use precise attribute-level edits to ensure that we don't disturb any other attributes in the MCP server config,
        // since some clients store additional attributes there (for example, whether an MCP server is enabled, or the  permissions for individual
        // tools).  We want to be able to swap in our shim reference (which will produce the same MCP server), without disturbing any client-specific
        // configuration for that MCP server.
        //
        // We originally collected edits and applied them in a batch on save, but this causes problems if we are injecting whitespace (indentation),
        // where an attribute change can rewrite containing objects, up to and including the entire JSON contents, to apply the whitespace changes.
        // This produces overlapping edits that cannot be applied in a single pass.  The only way to avoid this is to apply edits one at a time,
        // so we just apply them as we go.

        this.applyModification(this.getMcpConfigPath(serverName, 'type'), newConfig.type);
        if (newConfig.type === 'stdio') {
            this.applyModification(this.getMcpConfigPath(serverName, 'command'), newConfig.command);
            if (newConfig.args) {
                this.applyModification(this.getMcpConfigPath(serverName, 'args'), newConfig.args);
            } else if (currentConfig.args) {
                this.applyModification(this.getMcpConfigPath(serverName, 'args'), undefined);
            }
            if (newConfig.env) {
                this.applyModification(this.getMcpConfigPath(serverName, 'env'), newConfig.env);
            } else if (currentConfig.env) {
                this.applyModification(this.getMcpConfigPath(serverName, 'env'), undefined);
            }
            if (newConfig.cwd) {
                this.applyModification(this.getMcpConfigPath(serverName, 'cwd'), newConfig.cwd);
            } else if (currentConfig.cwd) {
                this.applyModification(this.getMcpConfigPath(serverName, 'cwd'), undefined);
            }
            // Clean up any SSE/streamable properties
            if (currentConfig.url) {
                this.applyModification(this.getMcpConfigPath(serverName, 'url'), undefined);
            }
            if (currentConfig.headers) {
                this.applyModification(this.getMcpConfigPath(serverName, 'headers'), undefined);
            }
        } else if (newConfig.type === 'sse' || newConfig.type === 'streamable') {
            this.applyModification(this.getMcpConfigPath(serverName, 'url'), newConfig.url);
            if (newConfig.headers) {
                this.applyModification(this.getMcpConfigPath(serverName, 'headers'), newConfig.headers);
            } else if (currentConfig.headers) {
                this.applyModification(this.getMcpConfigPath(serverName, 'headers'), undefined);
            }
            // Clean up any stdio properties
            if (currentConfig.command) {
                this.applyModification(this.getMcpConfigPath(serverName, 'command'), undefined);
            }
            if (currentConfig.args) {
                this.applyModification(this.getMcpConfigPath(serverName, 'args'), undefined);
            }
            if (currentConfig.env) {   
                this.applyModification(this.getMcpConfigPath(serverName, 'env'), undefined);
            }
        }
    }

    /**
     * Remove a server configuration
     * @param serverName The name of the server to remove
     */
    removeServer(serverName: string): void {
        this.applyModification(this.getMcpConfigPath(serverName), undefined);
    }

    /**
     * Save the config back to the file
     */
    async save(): Promise<void> {
        if (!this.hasEdits()) {
            return;
        }

        try {
            await fs.writeFile(this.filePath, this.currentContent);
        } catch (error) {
            throw new Error(`Failed to save config file ${this.filePath}: ${error}`);
        }
        this.originalContent = this.currentContent;
    }

    /**
     * Get the current config object
     */
    getConfig(): any {
        return this.config;
    }

    /**
     * Get the original file content
     */
    getOriginalContent(): string {
        return this.originalContent;
    }

    /**
     * Check if there are pending edits
     */
    hasEdits(): boolean {
        if (this.originalContent === '' && this.currentContent === '{}') {
            // Initializing non-existent config to an empty object is not an edit
            return false;
        }
        return this.currentContent !== this.originalContent;
    }

    /**
     * Clear all pending edits
     */
    clearEdits(): void {
        this.currentContent = this.originalContent;
    }
} 