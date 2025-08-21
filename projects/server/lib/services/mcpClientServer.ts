import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio';
import { McpClientBase, McpClient } from './mcpClient';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport';

export class McpClientStdio extends McpClientBase implements McpClient {
    private serverParams: StdioServerParameters;

    constructor(serverParams: StdioServerParameters) {
        super();
        this.serverParams = serverParams;
    }

    protected async createTransport(): Promise<Transport> {
        const transport = new StdioClientTransport({
            command: this.serverParams.command,
            args: this.serverParams.args ?? undefined,
            env: this.serverParams.env ?? undefined,
            cwd: this.serverParams.cwd ?? undefined,
            stderr: 'pipe'
        });

        // Capture stderr output
        if (transport.stderr) {
            transport.stderr.on('data', (data: Buffer) => {
                const logEntry = data.toString().trim();
                if (logEntry) {
                    this.addErrorMessage(`Server stderr: ${logEntry}`);
                }
            });
        }

        return transport;
    }
}
