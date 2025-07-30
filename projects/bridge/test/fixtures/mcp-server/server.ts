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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: [] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "name_of_tool") {
      return {};
    }
    throw new McpError(ErrorCode.InvalidRequest, "Tool not found");
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [{
        name: "reverse",
        description: "Reverses the input message",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to reverse"
            }
          },
          required: ["message"]
        }
      }]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "reverse") {
      const { message } = request.params.arguments as { message: string };
      return { content: [{ type: "text", text: `Reversed: ${message.split('').reverse().join('')}` }] };
    }
    throw new McpError(ErrorCode.InvalidRequest, "Tool not found");
  });

  return server;
};