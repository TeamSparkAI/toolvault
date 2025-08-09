# TeamSpark ToolVault

## Deploy

Build
  npm run build
Push 1.0.1 as @next 
  npm publish --tag next
Uninstall
  npm uninstall -g toolvault
  ./reset (clean)
  Remove Library/Application Support/ToolVault
Prepare
  Copy tomas_mcp.json to Claude project
  Copy unmanaged server to toolvault/.cursor/mcp.json
Install @next
  npm install -g toolvault@next
Test
  Import with tomas clients
  Import toolvault/cursor (unmanaged), test server (ping/tools)
Clean up todo.md
Push to main
Promote to @latest
  npm dist-tag add package-name@version latest
  npm dist-tag rm package-name@version next
Uninstall/reinstall (plain) - validate 1.0.1 install

## ENV var and home dir expansion

Need a way to inject local env vars in args/env/cwd
- Formatted as $ENV_VAR or ${ENV_VAR}
- Also support home dir expansion (leading ~)

Support functions implemented, need to deploy/test (clientEndpointStdio and MCP client code)
- Apply to args, env var values, cwd

Done
- Validate this won't interfere with wrapped servers (container env, volume mounts, etc)
- Validate expansion of home dir and env in all fields
  - Unmanaged server (ping/test)
  - Managed server

## Preflight noise

We are seeing some behavior from stdio MCP servers where they emit various content to stdout before they start talking JSONRPC.  The
StdioClientTransport throws an error on this, but it seems that most clients survive it just fine (they or their MCP clients don't even
listen for error events).  We currently we log an error and return a JSONRPC error. It might be better to just track the state of whether
we've seen a JSONRPC message yet, and if not, anything that doesn't parse as JSON gets sent to the log instead.  

Done: validate

## CWD support for stdio

We have encountered MCP servers that rely on running code (typically via node) relative to their own path (or the workspace path)
- They do not have a cwd param specifying the dir they need to run in (they just assume the project/workspace dir)
- For example, referencing an MCP server that is part of the project itself: node mcp-servers/our-server.js

Add cwd to stdio config throughout (structs, UX, etc)
When scanning MCP configs, add cwd to list of fields we bring in and can overwrite
- When encountering cwd with relative path, we will need to fix when converting to managed (convert to abs path, home path if possible)
- When importing a stdio server without a cwd, set it to the project directory (assuming we can determine that from the config file location)
  - Only for non-global conversions
  - Only for non npx-uvx servers (?)
- When deploying server (via bridge client endpoint), expand cwd (~ or env var refs), pass cwd to stdio transport
- Look at how this works when creating the client transport in the UX for test also

Done: Test to verify that server is actually run in cwd when
- Managed server
- Unmanaged server

## Misc

Client import/sync API should propagate common errors (config file not found, invalid JSON, no mcpServers or whatever attr the client uses, failed to write file)

When loading catalog via API, if underlying servers.json not loaded (maybe failed startup load), try again

## Manually adding a client

Consider manually adding client with configPath and how we support import/sync similar to discovery process
- Perform scan, optional import/containerization
- What do we do when saving with an updated configPath (invalidate last scan date, rescan?)
- What if autoUpdate is enabled (immediate scan, what if pending)

## Server Enable/Disable

If we disable a server and the client tries to use it, it will fail
This implies that if we disable a server, we should remove it from any client configs that reference it, and if we re-enable it, we should re-add it
This will require a new client-server syncState
- We will need a client-server record indicating syncStates for:
  - Disabled server that needs to be removed from config (pendingDisabled)
  - Disabled server that has been removed from config (disabled)
  - An enabled server that needs to be added to config (pendingEnabled)
  - An enabled server that exists on client - current syncState (scanned/pushed)
- When a client-server is in pendingDisabled, disabled, pendingEnabled, what operations can be done
  - Server can presumably always be removed or deleted, so how does that work from each new state?

====================================================================================================

## Packaging and Distribution (document in README.md)

To run from source:
- Pre-requisites: Node and Docker
- Get source repo
- npm build (verify command)
- npm install tsh globally
- Run server

NPM-based install
- npm install -g toolvault install tsh and toolvault
- Recommend pm2 for management (auto-run "as service")?

====================================================================================================

## Post v1.0

Command line --audit mode - do a scan of all tool use a produce a text and/or json report

Backup on scan - create tmp file for each modified config file on first rewrite so user could undo a client onboarding if needed

## API Auth

Web app
- Add /auth endpoint which returns bearer token (requires username/path if configured)
- Modify All API endpoints to require bearer auth (except /proxy which has its own implicit auth)
- Web app will auth user with login page
Local app (Electron)
- We don't need login security (Electron can use IPC to get a bearer token from itself and use that for all API calls)

### Packaged App install

tsh as exec via @yao-pkg/pkg (actively maintained fork of pkg)

ToolVault as Electron app
- Providing the same functionality as the current Web UX, and the current HTTP API backend
- Would be long-running and provide the API endpoints (both proxy and general).
  - It becomes the "service" (different on different OS), would have tray icon, etc
- We could still provide the web UX as an option (possibly for remote access, will need for server mode later)
- Both the Electron app and the web UX (if enabled) will talk to the HTTP API with bearer auth
  - The Electron app will use IPC to get / refresh the bearer token (a "no login" experience, since the app trusts itself)
  - The Web app would use some kind of login to get it's token, and some kind of token refresh
- We will share as much UX code as possible, and abstract the code so that it doens't know if it's in Electron or the browser

Installer to install both

### Policy application

Implement single scan (multi-regex) for perf (currently 750+ msgs/second on laptop with full policy set, perf improvement may not be high priority)

Should we support an option to replace entire field?  Entire response?  Replace message with error message?  Overlaps could be a lot more complex.

### Retention

Retention (alerts/messages) is implemented in a service and exposed at an API endpoint
- Still need a mechanism to trigger it (could have UX with stats and manual and/or do it automatically via cronjob style solution)

### Server Management

Add stats / graphs per server (pareto of called tools, etc)

### Containerized SSE/Streamable

We will have MCP server configs that are containerized (or can be) and that present SSE/Streamable
- Run this container, specify a port, container exposes SSE/Streamable MCP on that port

In this cases, we should manage the container lifecycle (and expose status to the UX)

We should make sure that only the gateway can connect to the container MCP endpoint
- We can bind the port to the localhost endpoint on launch (only local machine can connect)
- Locking it down to only allow connections from our gateway is a challenge, as would be layering in some kind of auth

Find some of the more popular versions of these and see how they work (auth? secret?)

### Container Support

Allow for docker or podman by config (user can just alias docker to podman, should work)
- What if no container support at all?  Lot's of UX would need to get turned off.
- How does Kubernetes factor into this?

### Library

Add Docker MCP directory as library source: integrate (with tag) or choose between catalog sources?
- https://github.com/docker/mcp-registry/tree/main/servers

### Import

Allow policy, client, server import (maybe export) via JSON

### Messages

Filter messages on error state (add dimension, filtering)

Full text search on message payload (brute force to start)

### Testing

More unit tests and integration tests
