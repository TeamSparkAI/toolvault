#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

console.error('Starting MCP server...');

async function main() {
  console.error('Really starting MCP server...');
  const transport = new StdioServerTransport();
  const server = createServer();

  console.error('Connecting to transport...');
  await server.connect(transport);

  // Cleanup on exit
  process.on("SIGTERM", async () => {
    console.error('SIGTERM');
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});