# Toolshed Proxy

tl;dr - We want to seamlessly handle any issues with config changes, connection loss, etc and present a long-running, stable stdio server to the client

Because: Many agents/clients behave poorly if a stdio MCP server exits or returns any kind of error in the MCP message payload

## Reconnect

Agent->tsh->stdioServer->session->sseClient->network->sseServer->session->client(any)

The shim (tsh) may become disconnected from its remote client endpoint (SSE/Streamable) for several reasons related to ToolVault state
- The ToolVault app restarts (previous sessions will be invalid, as will previous proxy configs as bearer token key will have changed, config may also have changed))
- The bridge (gateway host) restarts, possibly because it was reconfigured (gateway host/port may have changed, rendering proxy configs invalid)
- A managed server is updated (removed/added to bridge, invalidating any active sessions and closing connections)
- It's possible that some clients may survive the above without disconnecting (via retries, etc, if no host/port changes), but will then fail on auth

The bridge generates specific McpError message codes for the above cases (ConnectionClosed), which are generally non-recoverable without a config update
- We will get updated configuration, reconnect and authenticate, and re-initializing the MCP protocol (if required), so that we can continue

On ConnectionClosed
- Proxy attempts to get updated client endpoing config from /proxy, if the config is different it replaces the client endpoint config in the bridge
- The bridge then connects to the new endpoint, and if the MCP init has previously been done, it replays it to get the endpoint into the ready state
- If a message came in while reconnecting (we assume the client would only send one without a response), that message will saved and sent to the server when ready
- At this point we will have swapped out the config/endpoint and the client will work as if nothing happened
  
If we get a ConnectionClosed and we fail to get reconnect config (server is stopped/restarting), it's not really a problem until the client sends another message
- We attempt retries on a timer with a backoff.  If we exhaust retries, we wait for the next message to come in to trigger the final retry.

We detect whether failures are temporary (mainly that ToolVault isn't running) versus permanent failures, and we only attempt retries on temporary failures
- If we can't get the API endpoint, the server isn't running (it deletes the shared file on shutdown, recreates on startup) - that's a temporary failure
- If the /proxy endpoint isn't responsive, the server isn't running yet (likely starting up) - that's a temporary failure

### Test SSE [done]

- Reconfigured managed server, shim reconfigures and subsequent messages succeed
- Reconfigured (changed port) gateway which restarts it, shim reconfigures and subsequent messages succeed
- Reconfigured (changed protocol to streamable) gateway which restarts it, shim reconfigures and subsequent messages succeed
- Shut down server, shim disconnects, start server, shim reconnects on timer, subsequent messages succeed
- Shut down server, shim disconnects, let all retries fail, start server, verify that next message reconfigures and succeeds (also verified shim exits if fails to reconfigure in this case)
- Stop/start gateway host 
  - Stop gateway, wait 30 seconds, restart, make sure proxy reconfigures and subsequent requests succeed
  - Stop gateway, wait until all timeouts have expired, start gateway, send message, make sure reconfigures and message succeed
  - Stop gateway, wait until all timeouts have expired, don't start gateway, send message, make sure reconfigure fails and proxy exits

### Streamable Issues

With StreamableHTTP, the general message flow is via a request message POST that returns the response message (that's the HTTP part) - no persistent connection
Alternatively, you can use a GET request that will open an SSE streamable connection (with persistent connections)

So when we have only POST messages being used, there is not way to notify the streamable client that that streamable server has "disconnected"
- This means you don't find out until you send the next POST message that your session is invalid (at which point it's too late to "replace" the endpoint and maintain the session)

We could try to be more clever about replacing the gateway (bridge) clients (instead of remove/add, we do a replace that replays init like the proxy does)
- But that only solves the managed server update, the Tool Value or gateway reconfig and/or stop/start will still have the same issue (it doesn't fail until later)

I don't see any good way to make our in-place reconnect/reconfigure work with Streamable.  Alternatives:
- Only support SSE for gateway in Tool Vault
  - It works fine, it's local machine so long-lived persistent connections are fine, and we fixed the broken connection management in our SSE implementation
- Create our own client and server protocol that does what we need (but that might look an awful lot like SSE, so what value would we be adding?)

Tests
- Browser ping, tool list, tool test [done]
- Basic functionality - agent can start and access server via tsh [done]
- Update managed server config
  - Server closes transport, client doesn't get notified or disconnected
    - This is expected - we're using POST reuests, which don't maintain connections
  - When next message comes through, missing sessionId on server endpoint, fails hard, kills proxy
- Restart ToolVault on different port
  - Same issue as above
- Restart gateway as SSE on different port
  - Same issue as above
