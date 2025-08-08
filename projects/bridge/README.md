# MCP Link

MCP Link is a bridge that allows you to present any MCP server endpoint (stdio, sse, or streamable), and bridge it to any other server endpoint (stdio, sse, streamable, or a container).

When the target MCP server is stdio-container, an ephemeral Docker container will be spun up per MCP session and removed at the end of the session.

![MCP Link](https://github.com/TeamSparkAI/mcp-link/raw/main/assets/mcplink.png)

MCP Link is available both as a command line app and as an SDK that allows you to build your own MCP Link solutions, including the ability to process all messages going to and from the linked MCP servers.

### Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

### Using npm

To use MCP Link from anywhere in your system:

```bash
npm install -g mcp-link
```

Or to use it in your project:

```bash
npm install mcp-link
```

## Usage

```bash
mcplink [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--serverMode <mode>` | Server mode (sse, stdio, streamable) | "stdio" |
| `--clientMode <mode>` | Client mode (stdio, sse, streamable, stdio-container) | "stdio-container" |
| `--port <number>` | Server port | "3000" |
| `--host <string>` | Server host | "localhost" |
| `--image <string>` | Client container image | - |
| `--endpoint <string>` | Client endpoint | - |
| `--command <string>` | Client command | - |
| `--env <value>` | Environment variable (key=value) | [] |
| `--volume <value>` | Volume mapping | [] |
| `-h, --help` | Display help for command | - |

### Examples

```bash
# Run with stdio server and container client
mcplink --serverMode=stdio --clientMode=stdio-container --image=mcp/fetch

# Run with stdio server and container client (leveraging defaults)
mcplink --image=mcp/fetch

# Run with SSE server on custom port
mcplink --serverMode=sse --port=8080 --image=mcp/fetch

# Run with streamable server and stdio client
mcplink --serverMode=streamable --clientMode=stdio --command=npx mcp-fetch
```

> **Important Note for stdio Server Mode**: You can use the above command lines directly in your MCP using tool (your IDE). When the LLM connects to the `mcplink` MCP server, it will automatically be bridged to the linked MCP server.

### Source-Target Permutations

| Verified | Source Mode | Target Mode | Description |
|----------|-------------|-------------|-------------|
| ✅ | stdio | stdio | Direct stdio to stdio bridge |
| ✅ | stdio | sse | Bridge stdio source to SSE endpoint |
| ✅ | stdio | streamable | Bridge stdio source to streamable endpoint |
| ✅ | stdio | stdio-container | Bridge stdio source to containerized stdio endpoint |
| ✅ | sse | stdio | Bridge SSE source to stdio endpoint |
| ✅ | sse | sse | Direct SSE to SSE bridge |
| ✅ | sse | streamable | Bridge SSE source to streamable endpoint |
| ✅ | sse | stdio-container | Bridge SSE source to containerized stdio endpoint |
| ✅ | streamable | stdio | Bridge streamable source to stdio endpoint |
| ✅ | streamable | sse | Bridge streamable source to SSE endpoint |
| ✅ | streamable | streamable | Direct streamable to streamable bridge |
| ✅ | streamable | stdio-container | Bridge streamable source to containerized stdio endpoint |

## Development

This project uses Node.js and is implemented in TypeScript. It uses the Commander package for CLI functionality and Dockerode for container management.

### Building and Running Locally

If you want to build and run from source:

```bash
# Clone the repository
git clone https://github.com/TeamSparkAI/mcp-link.git
cd mcp-link

# Install dependencies
npm install

# Build the project
npm run build

# Run without installation
npm start -- [options]
```

## MCP Link SDK

MCP Link also exposes an SDK that will allow you to create your own apps that provide MCP Link functionality.

### Installation

In your project directory:

```bash
# Install and save to your project's dependencies
npm install mcp-link --save
```

### Usage

```typescript
import { startBridge } from 'toolvault-bridge';

// Start a bridge with the specified configuration
const bridge = await startBridge({
  serverMode: 'stdio',  // or 'sse', 'streamable'
  clientMode: 'stdio-container',  // or 'stdio', 'sse', 'streamable'
  port: 3000,  // optional, defaults to 3000
  host: 'localhost',  // optional, defaults to 'localhost'
  image: 'mcp/fetch',  // required for stdio-container mode
  endpoint: 'http://localhost:8080',  // optional, for sse/streamable modes
  command: 'npx mcp-fetch',  // optional, for stdio mode
  env: ['KEY=value'],  // optional, environment variables
  volume: ['/host/path:/container/path']  // optional, volume mappings
});

// The bridge will run until you stop it
// To stop the bridge:
await bridge.stop();
```

The SDK provides a programmatic interface to all the functionality available through the CLI. You can use it to create custom applications that need to bridge different MCP endpoints.

### Message Processing

You can process messages as they flow through the bridge by providing a message processor:

```typescript
import { startBridge } from 'toolvault-bridge';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';

const bridge = await startBridge({
  serverMode: 'stdio',
  clientMode: 'stdio-container',
  image: 'mcp/fetch',
  // Add a message processor to handle messages in both directions
  messageProcessor: {
    // Process messages going to the server
    forwardMessageToServer: async (message: JSONRPCMessage) => {
      console.log('[MessageProcessor] Forwarding message to server', message);
      return message;
    },
    // Process messages returning to the client
    returnMessageToClient: async (message: JSONRPCMessage) => {
      console.log('[MessageProcessor] Returning message to client', message);
      return message;
    }
  }
});

// The bridge will run until you stop it
await bridge.stop();
```

The message processor allows you to:
- Process messages in both directions (to server and to client)
- Log messages for debugging
- Transform message content
- Filter messages
- Add custom processing logic

## License

Apache-2.0