# MCP Link Testing

## Fixtures

### Client

For the test client, we use the standard MCP client / transports from the TypesScript SDK: https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#writing-mcp-clients

These save us some work, and also guarantees compatability (including bug compatability) with most client apps.

### Server

We use `everything` as our main test server fixture: https://github.com/modelcontextprotocol/servers/tree/main/src/everything
- We run it as:
  - *stdio* (default)
  - *sse* using arg: "sse" (port specified by PORT env var)
  - *streamable* using arg: "streamableHttp" (port specified by PORT env var)
  - *stdio-container*: mcp/everything
- We install @modelcontextprotocol/server-everything as a dev dependency and use that local code testing (except for the container version)
- We use its `echo` tool for our tests