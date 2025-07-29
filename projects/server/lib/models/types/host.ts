export type McpHostType = 'sse' | 'streamable';

export interface HostData {
    type: McpHostType;
    host?: string;
    port: number;
}