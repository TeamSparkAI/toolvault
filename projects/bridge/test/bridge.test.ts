import { Client } from '@modelcontextprotocol/sdk/client/index';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio";
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { CallToolResult, JSONRPCMessage } from "@modelcontextprotocol/sdk/types";
import { ChildProcess, spawn } from 'child_process';
import { join } from 'path';
import { AuthorizedMessageProcessor, ClientEndpointConfig, MessageProcessor, ServerEndpointConfig, startBridge } from '../src/api';
import { ServerEndpoint } from '../src/serverEndpoints/serverEndpoint';
import { ServerEndpointStreamable } from '../src/serverEndpoints/serverEndpointStreamable';
import { ServerEndpointHttpBase } from '../src/serverEndpoints/serverEndpointHttpBase';
import { SessionManagerImpl } from '../src/serverEndpoints/sessionManager';
import { ServerEndpointStdio } from '../src/serverEndpoints/serverEndpointStdio';
import { ServerEndpointSse } from '../src/serverEndpoints/serverEndpointSse';

// Note: All server/client mode permutations are tested in this file.

// Get the full path to server-everything (installed as a dev dependency which we run from the local code)
const serverEverythingPath = require.resolve('@modelcontextprotocol/server-everything/dist/index.js');
const testServerPath = join(__dirname, '../test/fixtures/mcp-server/index.ts');

const serverStartWaitMs = 2000;
const clientCloseWaitMs = 1000;
const containerClientCloseWaitMs = 15000;

function getTestClient() {
    return new Client({
        name: "test-client",
        version: "1.0.0"
    });
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getBridgeStdioTransport(args: string[]) {
    return new StdioClientTransport({
        command: "tsx",
        args: [join(__dirname, '../src/index.ts'), ...args],
    });
}

// !!! We didn't bring the CLI (src/index.ts) into the bridge package, so we can't use it here.
async function runBridgeServer(args: string[]): Promise<ChildProcess> {
    const server = spawn('tsx', [join(__dirname, '../src/index.js'), ...args]);
    await sleep(serverStartWaitMs); // Wait for the server to start
    return server;
}

async function runEverythingServer(mode: string, testPort: number): Promise<ChildProcess> {
    const server = spawn('node', [serverEverythingPath, mode], {
        env: {
            ...process.env,
            PORT: testPort.toString()
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    server.stdout?.on('data', (data) => {
        console.log(`[server-everything] ${data}`);
    });

    server.stderr?.on('data', (data) => {
        console.error(`[server-everything] ${data}`);
    });

    // Wait for the server to start
    await sleep(1000);
    return server;
}

async function terminateServer(name: string, server: ChildProcess, timeoutMs: number = 30000): Promise<void> {
    console.log(`Terminating server ${name} (pid: ${server.pid})`);
    const startTime = Date.now();
    
    try {
        // Check if process is still running
        process.kill(server.pid!, 0);  // This will throw if process doesn't exist
        // If we get here, process is running, so kill it and wait
        server.kill();
        await Promise.race([
            new Promise<void>((resolve) => {
                server.once('exit', (code, signal) => {
                    const duration = Date.now() - startTime;
                    console.log(`Server ${name} exited with code ${code} and signal ${signal} after ${duration}ms`);
                    resolve();
                });
            }),
            new Promise<void>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Server ${name} did not exit within ${timeoutMs}ms`));
                }, timeoutMs);
            })
        ]);
    } catch (err) {
        // Process is already gone, nothing to do
        console.log(`Server ${name} is already terminated`);
    }
}

let _port = 34567;
function getTestPort() {
    return _port++;
}

describe('MCP Link', () => {
    describe('stdio->stdio-test', () => {
        let transport: Transport;
        const client = getTestClient();
        
        beforeAll(async () => {
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=stdio', '--command=tsx', testServerPath]);
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'reverse', arguments: { message: 'Hello' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Reversed: olleH' });
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            console.log('Cleanup complete');
        });
    });

    describe('stdio->stdio', () => {
        let transport: Transport;
        const client = getTestClient();
        
        beforeAll(async () => {
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=stdio', '--command=node', serverEverythingPath]);
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            console.log('Cleanup complete');
        });
    });

    describe('stdio->sse', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = 34567;

        beforeAll(async () => {
            server = await runEverythingServer('sse', testPort);
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=sse', '--endpoint=http://localhost:' + testPort + '/sse']);
        });

        it('should successfully execute echo command', async () => {
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });

        afterAll(async () => {
            // SSE server cleanup
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            await terminateServer("server", server);
            console.log('Cleanup complete');
        });
    });

    describe('stdio->streamable', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = getTestPort();

        beforeAll(async () => {
            server = await runEverythingServer('streamableHttp', testPort);
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=streamable', '--endpoint=http://localhost:' + testPort + '/mcp']);
        });

        it('should successfully execute echo command', async () => {
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            await terminateServer("server", server);
            console.log('Cleanup complete');
        });
    });

    describe('stdio->stdio-container', () => {
        let transport: Transport;
        const client = getTestClient();
        
        beforeAll(async () => {
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=stdio-container', '--image=mcp/everything']);
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close(); // This SIGTERMs the stdio target (our app) but doesn't wait for it to exit, and we do an async shutdown of the container
            await sleep(containerClientCloseWaitMs);
            console.log('Cleanup complete');
        }, 60000);
    });

    describe('sse->stdio', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = getTestPort();
        
        beforeAll(async () => {
            server = await runBridgeServer(['--serverMode=sse', '--port=' + testPort, '--clientMode=stdio', '--command=node', serverEverythingPath]);
            transport = new SSEClientTransport(new URL('http://localhost:' + testPort + '/sse'));
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });
        
        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            await terminateServer("server", server);
            console.log('Cleanup complete');
        });
    });

    describe('sse->sse', () => {
        let transport: Transport;
        const client = getTestClient();
        let proxiedServer: ChildProcess;
        let server: ChildProcess;
        const proxiedTestPort = getTestPort();
        const testPort = getTestPort();
        
        beforeAll(async () => {
            proxiedServer = await runEverythingServer('sse', proxiedTestPort);
            server = await runBridgeServer(['--serverMode=sse', '--port=' + testPort, '--clientMode=sse', '--endpoint=http://localhost:' + proxiedTestPort + '/sse']);
            transport = new SSEClientTransport(new URL('http://localhost:' + testPort + '/sse'));
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });
        
        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            await terminateServer("server", server);
            await terminateServer("proxiedServer", proxiedServer);
            console.log('Cleanup complete');
        });
    });

    describe('sse->streamable', () => {
        let transport: Transport;
        const client = getTestClient();
        let proxiedServer: ChildProcess;
        let server: ChildProcess;
        const proxiedTestPort = getTestPort();
        const testPort = getTestPort();
        
        beforeAll(async () => {
            proxiedServer = await runEverythingServer('streamableHttp', proxiedTestPort);
            server = await runBridgeServer(['--serverMode=sse', '--port=' + testPort, '--clientMode=streamable', '--endpoint=http://localhost:' + proxiedTestPort + '/mcp']);
            transport = new SSEClientTransport(new URL('http://localhost:' + testPort + '/sse'));
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });
        
        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            await terminateServer("server", server);
            await terminateServer("proxiedServer", proxiedServer);
            console.log('Cleanup complete');
        });
    });

    describe('sse->stdio-container', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = getTestPort();

        beforeAll(async () => {
            server = await runBridgeServer(['--serverMode=sse', '--port=' + testPort, '--clientMode=stdio-container', '--image=mcp/everything']);
            transport = new SSEClientTransport(new URL('http://localhost:' + testPort + '/sse'));
        });
        
        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        }); 

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(containerClientCloseWaitMs);
            await terminateServer("server", server);
            console.log('Cleanup complete');
        }, 60000);
    });

    describe('streamable->stdio', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = getTestPort();
        
        beforeAll(async () => {
            server = await runBridgeServer(['--serverMode=streamable', '--port=' + testPort, '--clientMode=stdio', '--command=node', serverEverythingPath]);
            transport = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/mcp'));
        });

        it('should successfully execute echo command', async () => {
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });
        
        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            await terminateServer("server", server);
            console.log('Cleanup complete');
        });
    });

    describe('streamable->sse', () => {
        let transport: Transport;
        const client = getTestClient();
        let proxiedServer: ChildProcess;
        let server: ChildProcess;
        const proxiedTestPort = getTestPort();
        const testPort = getTestPort();
        
        beforeAll(async () => {
            proxiedServer = await runEverythingServer('sse', proxiedTestPort);
            server = await runBridgeServer(['--serverMode=streamable', '--port=' + testPort, '--clientMode=sse', '--endpoint=http://localhost:' + proxiedTestPort + '/sse']);
            transport = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/mcp'));
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });
        
        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            await terminateServer("server", server);
            await terminateServer("proxiedServer", proxiedServer);
            console.log('Cleanup complete');
        });
    });

    describe('streamable->streamable', () => {
        let transport: Transport;
        const client = getTestClient();
        let proxiedServer: ChildProcess;
        let server: ChildProcess;
        const proxiedTestPort = getTestPort();
        const testPort = getTestPort();
        
        beforeAll(async () => {
            proxiedServer = await runEverythingServer('streamableHttp', proxiedTestPort);
            server = await runBridgeServer(['--serverMode=streamable', '--port=' + testPort, '--clientMode=streamable', '--endpoint=http://localhost:' + proxiedTestPort + '/mcp']);
            transport = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/mcp'));
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        });
        
        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            await terminateServer("server", server);
            await terminateServer("proxiedServer", proxiedServer);
            console.log('Cleanup complete');
        });
    });

    describe('streamable->stdio-container', () => {
        let transport: Transport;
        const client = getTestClient();
        let server: ChildProcess;
        const testPort = getTestPort();

        beforeAll(async () => {
            server = await runBridgeServer(['--serverMode=streamable', '--port=' + testPort, '--clientMode=stdio-container', '--image=mcp/everything']);
            transport = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/mcp'));
        });
        
        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
        }); 

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(containerClientCloseWaitMs);
            await terminateServer("server", server);
            console.log('Cleanup complete');
        }, 60000);
    });

    describe('streamable->stdio with filtering', () => {
        const client = getTestClient();
        let transport: Transport;
        let bridge: ServerEndpoint;
        const testPort = getTestPort();

        const serverEndpoint: ServerEndpointConfig = {
            mode: 'streamable',
            port: testPort,
        }

        const clientEndpoint: ClientEndpointConfig = {
            mode: 'stdio',
            command: 'node',
            args: [serverEverythingPath],
        }

        let forwardMessageCalled = false;
        let returnMessageCalled = false;

        const messageProcessor: MessageProcessor = {
            forwardMessageToServer: async (serverName: string | null, sessionId: string, message: JSONRPCMessage) => {
                console.log('[MessageProcessor] Forwarding message to server', sessionId, message);
                if ('method' in message && message.jsonrpc === '2.0' && message.method === 'tools/call' && message.params?.name === 'echo' && (message.params?.arguments as { message: string })?.message === 'Hello, World!') {
                    forwardMessageCalled = true;
                }
                return message;
            },
            returnMessageToClient: async (serverName: string | null, sessionId: string, message: JSONRPCMessage) => {
                console.log('[MessageProcessor] Returning message to client', sessionId, message);
                if ('result' in message && message.jsonrpc === '2.0' && (message.result?.content as any[])?.[0]?.type === 'text' && (message.result?.content as any[])?.[0]?.text === 'Echo: Hello, World!') {
                    returnMessageCalled = true;
                }
                return message;
            }
        }
        
        beforeAll(async () => {
            bridge = await startBridge(serverEndpoint, [clientEndpoint], messageProcessor);
            await sleep(serverStartWaitMs); // Wait for the bridge to be ready to accept connections
            transport = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/mcp'));
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
            expect(forwardMessageCalled).toBe(true);
            expect(returnMessageCalled).toBe(true);
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await bridge.stop(false);
            console.log('Cleanup complete');
        });
    });

    describe('streamable->stdio with auth and filtering', () => {
        const client = getTestClient();
        let transport: Transport;
        let bridge: ServerEndpoint;
        const testPort = getTestPort();

        const serverEndpoint: ServerEndpointConfig = {
            mode: 'streamable',
            port: testPort,
        }

        const clientEndpoint: ClientEndpointConfig = {
            mode: 'stdio',
            command: 'node',
            args: [serverEverythingPath],
        }

        let forwardMessageCalled = false;
        let returnMessageCalled = false;

        const authUser = {
            name: 'test-user',
            email: 'test@test.com',
        }

        let authorizeCalled = false;

        const messageProcessor: AuthorizedMessageProcessor = {
            authorize: async (serverName: string | null, authHeader: string): Promise<any> => {
                authorizeCalled = true;
                console.log('[MessageProcessor] Authorizing client', authHeader);
                expect(serverName).toBeNull();
                return authUser;
            },
            forwardMessageToServer: async (serverName: string | null, sessionId: string, message: JSONRPCMessage, authPayload: any) => {
                console.log('[MessageProcessor] Forwarding message to server', sessionId, message);
                expect(serverName).toBeNull();
                expect(authPayload).toEqual(authUser);
                if ('method' in message && message.jsonrpc === '2.0' && message.method === 'tools/call' && message.params?.name === 'echo' && (message.params?.arguments as { message: string })?.message === 'Hello, World!') {
                    forwardMessageCalled = true;
                }
                return message;
            },
            returnMessageToClient: async (serverName: string | null, sessionId: string, message: JSONRPCMessage, authPayload: any) => {
                expect(serverName).toBeNull();
                expect(authPayload).toEqual(authUser);
                console.log('[MessageProcessor] Returning message to client', sessionId, message);
                if ('result' in message && message.jsonrpc === '2.0' && (message.result?.content as any[])?.[0]?.type === 'text' && (message.result?.content as any[])?.[0]?.text === 'Echo: Hello, World!') {
                    returnMessageCalled = true;
                }
                return message;
            }
        };
        
        beforeAll(async () => {
            bridge = await startBridge(serverEndpoint, [clientEndpoint], messageProcessor);
            await sleep(serverStartWaitMs); // Wait for the bridge to be ready to accept connections
            transport = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/mcp'));
        });

        it('should successfully execute echo command', async () => {    
            await client.connect(transport);
            expect(authorizeCalled).toBe(true);
            const result = await client.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
            expect(forwardMessageCalled).toBe(true);
            expect(returnMessageCalled).toBe(true);
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            await bridge.stop(false);
            console.log('Cleanup complete');
        });
    });

    describe('streamable->stdio with multiple client endpoints', () => {
        const clientEverything = getTestClient();
        const clientTest = getTestClient();
        let transportEverything: Transport;
        let transportTest: Transport;
        let bridge: ServerEndpoint;
        const testPort = getTestPort();

        const serverEndpoint: ServerEndpointConfig = {
            mode: 'streamable',
            port: testPort,
        }

        const clientEndpointEverything: ClientEndpointConfig = {
            name: 'everything',
            mode: 'stdio',
            command: 'node',
            args: [serverEverythingPath],
        }

        const clientEndpointTest: ClientEndpointConfig = {
            name: 'test',
            mode: 'stdio',
            command: 'tsx',
            args: [testServerPath],
        }
        
        beforeAll(async () => {
            bridge = await startBridge(serverEndpoint, [clientEndpointEverything, clientEndpointTest]);
            await sleep(serverStartWaitMs); // Wait for the bridge to be ready to accept connections
            transportEverything = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/' + clientEndpointEverything.name + '/mcp'));
            transportTest = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/' + clientEndpointTest.name + '/mcp'));
        });

        it('should successfully execute echo command', async () => {    
            await clientEverything.connect(transportEverything);
            const result = await clientEverything.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got echo result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
            await clientTest.connect(transportTest);
            const resultTest = await clientTest.callTool({name: 'reverse', arguments: { message: 'Hello' }}) as CallToolResult;
            console.log('Got reverse result:', resultTest.content);
            expect(resultTest.content).toBeDefined();
            expect(resultTest.content?.[0]).toEqual({ type: 'text', text: 'Reversed: olleH' });
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await clientEverything.close();
            await clientTest.close();
            await sleep(clientCloseWaitMs);
            await bridge.stop(false);
            console.log('Cleanup complete');
        });
    });

    describe('streamable->stdio with multiple client endpoints with filtering', () => {
        const clientEverything = getTestClient();
        const clientTest = getTestClient();
        let transportEverything: Transport;
        let transportTest: Transport;
        let bridge: ServerEndpoint;
        const testPort = getTestPort();

        const serverEndpoint: ServerEndpointConfig = {
            mode: 'streamable',
            port: testPort,
        }

        const clientEndpointEverything: ClientEndpointConfig = {
            name: 'everything',
            mode: 'stdio',
            command: 'node',
            args: [serverEverythingPath],
        }

        const clientEndpointTest: ClientEndpointConfig = {
            name: 'test',
            mode: 'stdio',
            command: 'tsx',
            args: [testServerPath],
        }

        let forwardMessageEverythingCalled = false;
        let forwardMessageTestCalled = false;
        let returnMessageEverythingCalled = false;
        let returnMessageTestCalled = false;
        
        const messageProcessor: MessageProcessor = {
            forwardMessageToServer: async (serverName: string | null, sessionId: string, message: JSONRPCMessage) => {
                expect(serverName).toBeDefined();
                console.log('[MessageProcessor] Forwarding message to server', sessionId, message);
                if (serverName === clientEndpointEverything.name) {
                    forwardMessageEverythingCalled = true;
                } else if (serverName === clientEndpointTest.name) {
                    forwardMessageTestCalled = true;
                }
                return message;
            },
            returnMessageToClient: async (serverName: string | null, sessionId: string, message: JSONRPCMessage) => {
                expect(serverName).toBeDefined();
                console.log('[MessageProcessor] Returning message to client', sessionId, message);
                if (serverName === clientEndpointEverything.name) { 
                    returnMessageEverythingCalled = true;
                } else if (serverName === clientEndpointTest.name) {
                    returnMessageTestCalled = true;
                }
                return message;
            }
        }

        beforeAll(async () => {
            bridge = await startBridge(serverEndpoint, [clientEndpointEverything, clientEndpointTest], messageProcessor);
            await sleep(serverStartWaitMs); // Wait for the bridge to be ready to accept connections
            transportEverything = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/' + clientEndpointEverything.name + '/mcp'));
            transportTest = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/' + clientEndpointTest.name + '/mcp'));
        });

        it('should successfully execute echo command', async () => {    
            await clientEverything.connect(transportEverything);
            const result = await clientEverything.callTool({name: 'echo', arguments: { message: 'Hello, World!' }}) as CallToolResult;
            console.log('Got echo result:', result.content);
            expect(result.content).toBeDefined();
            expect(result.content?.[0]).toEqual({ type: 'text', text: 'Echo: Hello, World!' });
            await clientTest.connect(transportTest);
            const resultTest = await clientTest.callTool({name: 'reverse', arguments: { message: 'Hello' }}) as CallToolResult;
            console.log('Got reverse result:', resultTest.content);
            expect(resultTest.content).toBeDefined();
            expect(resultTest.content?.[0]).toEqual({ type: 'text', text: 'Reversed: olleH' });
            expect(forwardMessageEverythingCalled).toBe(true);
            expect(forwardMessageTestCalled).toBe(true);
            expect(returnMessageEverythingCalled).toBe(true);
            expect(returnMessageTestCalled).toBe(true);
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await clientEverything.close();
            await clientTest.close();
            await sleep(clientCloseWaitMs);
            await bridge.stop(false);
            console.log('Cleanup complete');
        });
    });

    describe('stdio->stdio-test-stderr', () => {
        let transport: Transport;
        const client = getTestClient();
        
        beforeAll(async () => {
            transport = getBridgeStdioTransport(['--serverMode=stdio', '--clientMode=stdio', '--command=npx', 'bad-package-name-xxx']);
        });

        it('should fail to start', async () => {
            console.log('Connecting to transport');
            try {
                await client.connect(transport);
            } catch (error) {
                expect(error).toBeDefined();
                expect((error as Error).message).toContain('MCP error -32000: Server closed');
                expect((error as any).code).toBe(-32000);
                return;
            }
            fail('Expected error to be thrown');
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await client.close();
            await sleep(clientCloseWaitMs);
            console.log('Cleanup complete');
        });
    });

    describe('bridge stdio start failures with stderr', () => {
        let bridge: ServerEndpoint;
        const testPort = getTestPort();
        const clientTest = getTestClient();
        let transportTest: Transport;

        const serverEndpoint: ServerEndpointConfig = {
            mode: 'streamable',
            port: testPort,
        }

        const clientEndpointEverything: ClientEndpointConfig = {
            name: 'everything',
            mode: 'stdio',
            command: 'node',
            args: [serverEverythingPath],
        }

        const clientEndpointTest: ClientEndpointConfig = {
            name: 'test',
            mode: 'stdio',
            command: 'npx',
            args: ['bad-package-reference-xxx'],
        }

        const messageProcessor: MessageProcessor = {
            forwardMessageToServer: async (serverName: string | null, sessionId: string, message: JSONRPCMessage) => {
                console.log('Forwarding message to server', serverName, sessionId, message);
                return message;
            },
            returnMessageToClient: async (serverName: string | null, sessionId: string, message: JSONRPCMessage) => {
                console.log('Returning message to client', serverName, sessionId, message);
                return message;
            }
        }

        beforeAll(async () => {
            bridge = await startBridge(serverEndpoint, [clientEndpointEverything, clientEndpointTest], messageProcessor);
            await sleep(serverStartWaitMs); // Wait for the bridge to be ready to accept connections
            transportTest = new StreamableHTTPClientTransport(new URL('http://localhost:' + testPort + '/' + clientEndpointTest.name + '/mcp'));
            //transportTest = new SSEClientTransport(new URL('http://localhost:' + testPort + '/' + clientEndpointTest.name + '/sse'));
        });

        it('should detect failed startup and provide stderr', async () => {
            try {   
                console.log('Connecting to transport');
                await clientTest.connect(transportTest);
            } catch (error) {
                expect(error).toBeDefined();
                expect((error as Error).message).toContain('MCP error -32000: Server closed');
                expect(bridge.getClientEndpoint(clientEndpointTest.name!)!.getLogEvents().map(e => e.message).join('\n')).toContain('npm error 404 Not Found');
                return;
            }
            fail('Expected error to be thrown');
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await bridge.stop(false);
            console.log('Cleanup complete');
        });
    });

    describe('bridge streamable server on port 0', () => {
        let bridge: ServerEndpoint;
        let transportTest: Transport;

        const serverEndpoint: ServerEndpointConfig = {
            mode: 'streamable',
            port: 0,
        }

        const clientEndpointEverything: ClientEndpointConfig = {
            name: 'everything',
            mode: 'stdio',
            command: 'node',
            args: [serverEverythingPath],
        }

        beforeAll(async () => {
            bridge = await startBridge(serverEndpoint, [clientEndpointEverything]);
            await sleep(serverStartWaitMs); // Wait for the bridge to be ready to accept connections
        });

        it('should record acxtual port', async () => {
            expect(bridge.type).toBe('streamable');
            expect((bridge as any).port).toBeDefined();
            expect((bridge as any).port).toBeGreaterThan(0);
        });

        afterAll(async () => {
            console.log('Cleaning up...');
            await bridge.stop(false);
            console.log('Cleanup complete');
        });
    });
});
