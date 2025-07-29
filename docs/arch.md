# ToolShed Architecture

## Shim -> Gateway

Shim: Stdio MCP server (runnable via "tsh [toolname] [clientToken]")

Gateway: Web app providing management UX, management API, and proxy API endpoints, as well as MCP gateway host

On startup of shim (MCP server "session") by client
- Shim calls gateway endpoint /api/v1/proxy/[serverName] with user/client metadata, credentials, and tool name
- Gateway responds with server config
  - An SSE endpoint at the MCP gateway host endpoint
  - Config includes authorization header with bearer token to auth the endpoint and message processor
- Shim instantiates MCP link to the config provided, and commences exchange messages
- The gateway runs all message through its message processor for filtering, storage, etc

## Gateway

Presents web-based UX
Presents REST API
Presents REST API docs/test (Swagger)
Presents Gateway "Hosts" endpoint (SSE in front of multiple hosted servers)
  
REST API
- User management, client management
- MCP server catalog
- MCP servers configuration
- Analytics (time-series, aggregation, dimension values)
- Proxy (get tool config for shim, process messages from shim)

Tracks all jsonrpc messages

Can host MCP servers of any type

Tool ping/test functionality by calling tool via host endpoint
