# Toolshed Proxy

## Proxied Stdio MCP Servers

Stdio MPC servers running in containers are executed with an ephemeral container per client session/connection, because:

The original idea with stdio containers was to have a long-running container that we would proxy requests to, but this presented
some isses.  So insteasd, we now create a container-per-session (connection) and stop/destroy them when the session ends (when the
connection is closed).

For the long-lived stio container solution, I attempted injecting the seessionId into the json-rpc message id field (prefixing the 
existing id, if any), in order to associate response messages with the original connection.  This worked in some cases, but it broke
some MCP servers (including fetch) which expects a notifications/initialized with no message id (when an id was provided, it crashed
the server, which treated it as command inviation before initialization).  More details on the server lifecycle can be found here:
 
https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle

The reason that the notifications/initialized is treated as a request and not a notification when it has an id is the MCP SDK 
protocol handler filters messages to see if they are request, response, or notification, and the message id classifies the message
as a request (not a notification).  That little nugget can be found here:

https://github.com/modelcontextprotocol/typescript-sdk/blob/3f429895fb923717fe2b15934eeb6a11e2578e64/src/shared/protocol.ts#L293