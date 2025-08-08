import { Server } from "@modelcontextprotocol/sdk/server/index";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types";

export const createServer = () => {
  const server = new Server({
    name: "test-mcp-server",
    version: "1.0.0",
  }, {
    capabilities: {
      tools: {}
    }
  });

  console.error('Server created', server);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error('ListToolsRequestSchema');
    return {
      tools: [
        {
          name: "reverse",
          description: "Reverses the input message",
          inputSchema: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The message to reverse"
              }
            },
            required: ["message"]
          }
        },
        {
          name: "config",
          description: "Returns the configuration",
          inputSchema: {
            type: "object",
            properties: {}
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.error('CallToolRequestSchema', request);
    if (request.params.name === "reverse") {
      const { message } = request.params.arguments as { message: string };
      return { content: [{ type: "text", text: `Reversed: ${message.split('').reverse().join('')}` }] };
    }
    if (request.params.name === "config") {
      const args = process.argv.slice(2);
      const env = process.env;
      return { content: [{ type: "text", text: `Args: ${JSON.stringify(args, null, 2)} Environment: ${JSON.stringify(env, null, 2)}` }] };
    }
    throw new McpError(ErrorCode.InvalidRequest, "Tool not found");
  });

  return server;
};