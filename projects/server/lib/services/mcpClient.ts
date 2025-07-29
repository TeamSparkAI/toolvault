import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types";
import { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { log } from '@/lib/logging/console';

export interface McpClient {
    serverVersion: { name: string; version: string } | null;
    serverTools: Tool[];
    connect(): Promise<boolean>;
    disconnect(): Promise<void>;
    callTool(tool: Tool, args?: Record<string, unknown>): Promise<{ result: CallToolResult; elapsedTimeMs: number }>;
    cleanup(): Promise<void>;
    getErrorLog(): string[];
    isConnected(): boolean;
    ping(): Promise<{ elapsedTimeMs: number }>;
}

export abstract class McpClientBase {
    protected mcp: Client;
    protected transport: Transport | null = null;
    protected errorLog: string[] = [];
    protected readonly MAX_LOG_ENTRIES = 100;  // Keep last 100 error messages
    serverVersion: { name: string; version: string } | null = null;
    serverTools: Tool[] = [];
    protected connected: boolean = false;

    constructor() {
        this.mcp = new Client({
            name: "mcp-client",
            version: "1.0.0",
            transport: null
        });
    }

    protected abstract createTransport(): Promise<Transport>;

    protected addErrorMessage(message: string) {
        if (message.trim()) {
            this.errorLog.push(message);
            // Keep only the most recent messages
            if (this.errorLog.length > this.MAX_LOG_ENTRIES) {
                this.errorLog.shift();
            }
        }
    }

    getErrorLog(): string[] {
        return [...this.errorLog];
    }

    clearErrorLog(): void {
        this.errorLog = [];
    }

    isConnected(): boolean {
        return this.connected;
    }

    async connect(): Promise<boolean> {
        if (this.connected) {
            log.debug('[MCP CLIENT] Already connected, skipping connect');
            return true;
        }

        this.transport = await this.createTransport();

        try {
            this.transport.onerror = (err: Error) => {
                const message = `Transport error: ${err.message}`;
                log.error(message);
            };

            this.mcp.onerror = (err: Error) => {
                const message = `MCP client error: ${err.message}`;
                log.error(message);
            };

            await this.mcp.connect(this.transport);
            this.connected = true;

            const serverVersion = this.mcp.getServerVersion();
            this.serverVersion = serverVersion ? { 
                name: serverVersion.name, 
                version: serverVersion.version 
            } : null;
            const toolsResult = await this.mcp.listTools();
            this.serverTools = toolsResult.tools;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.error(`Error connecting to MCP server: ${message}`);
            this.addErrorMessage(`Error connecting to MCP server: ${message}`);
            this.connected = false;
        }

        return this.connected;
    }

    async onDisconnect() {
        this.transport?.close();
        this.transport = null;
        this.connected = false;
    }

    async callTool(tool: Tool, args?: Record<string, unknown>): Promise<{ result: CallToolResult; elapsedTimeMs: number }> {
        if (!this.connected) { await this.connect(); }
        if (!this.connected) { throw new Error('Not connected to MCP server'); }
        const startTime = performance.now();
        const result = await this.mcp.callTool({name: tool.name, arguments: args}) as CallToolResult;
        const elapsedTimeMs = performance.now() - startTime;
        
        return {
            result,
            elapsedTimeMs
        };
    }

    async ping(): Promise<{ elapsedTimeMs: number }> {
        if (!this.connected) { await this.connect(); }
        if (!this.connected) { throw new Error('Not connected to MCP server'); }
        const startTime = performance.now();
        await this.mcp.ping();
        return { elapsedTimeMs: performance.now() - startTime };
    }

    async disconnect(): Promise<void> {
        await this.cleanup();
    }

    async cleanup(): Promise<void> {
        if (this.transport) {
            await this.transport.close();
            this.transport = null;
        }
        await this.mcp.close();
    }
}

export class McpClientSse extends McpClientBase implements McpClient {
    private url: URL;
    private headers: Record<string, string> = {};

    constructor(url: URL, headers?: Record<string, string>) {
        super();
        this.url = url;
        this.headers = headers || {};
    }

    protected async createTransport(): Promise<Transport> {
        let transport: Transport;
        let fetchCount: number = 0;

        // There is a nasty bug where when an SSE client transport loses connection, it will reconnect, but not renegotiate the MCP protocol, 
        // so the transport will be in a broken state and subsequent calls to fetch will fail.
        // https://github.com/modelcontextprotocol/typescript-sdk/issues/510    
        //
        // The workaround below is to intercept the session initialization fetch call to identify ones where the session will be corrupted
        // and recycle the transport accordingly.
        //
        const onEventSourceInitFetch = async (url: string | URL, init: RequestInit | undefined, headers?: Headers): Promise<Response> => {
            fetchCount++;
            if (fetchCount > 1) {
                this.onDisconnect();
                return new Response(null, { status: 400, statusText: 'SSE Connection terminated, will reconnect on next message' });
            } else {
                return fetch(url.toString(), { ...init, headers });
            }
        };

        if (Object.keys(this.headers).length > 0) {
            // Create a fetch wrapper that adds headers
            const fetchWithHeaders = (url: string | URL, init?: RequestInit) => {
                const headers = new Headers(init?.headers);
                Object.entries(this.headers).forEach(([key, value]) => {
                    headers.set(key, value);
                });
                return onEventSourceInitFetch(url, init, headers);
            };
            
            const transport = new SSEClientTransport(this.url, {
                eventSourceInit: {
                    fetch: fetchWithHeaders
                }
            });

            return transport;
        } else {
            transport = new SSEClientTransport(this.url, {
                eventSourceInit: {
                    fetch: (url, init) => {
                        return onEventSourceInitFetch(url, init);
                    }
                }
            });
        }

        return transport;
    }
}

export class McpClientStreamable extends McpClientBase implements McpClient {
    private url: URL;
    private headers: Record<string, string> = {};

    constructor(url: URL, headers?: Record<string, string>) {
        super();
        this.url = url;
        this.headers = headers || {};
    }

    protected async createTransport(): Promise<Transport> {
        const transport = new StreamableHTTPClientTransport(this.url, {
            requestInit: {
                headers: this.headers
            }
        });        

        return transport;
    }
}