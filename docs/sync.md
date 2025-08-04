# ToolVault Client-Server Relationship Management

We maintain a client-server record that represents the relationship between a client and a server

The servers include managed servers (servers configred in and managed by ToolVault) and unmanaged servers (configured directly in the client)

When a ToolVault client has a configPath, we can scan that client to discover the servers it references and we can push server configs to it
- If automatic sync is set, we push changes in real time, otherwise on demand

Client state (with respect to client-server sync)
- Unlinked (no config path)
- Linked (config path) 
  - Manual (no auto update)
  - Auto (auto updated)

## Note: Scanning Servers

When we do a scan, the goal is to make the resulting relation/server state match the found/scanned state
- This may override the intent of any un-pushed server changes for the client
- If there are pending changes on scan, we warn that they will be lost (and suggest pushing them first)
- We could scan after applying pending changes 
  - But maybe only after applying all changes - if you pushed one pending change, a full scan could still lose state of other pending changes

## Note: Unmanaged Servers

An "unmanged" server is a server that ToolVault has discovered when scanning a client config.  
This server is considered "unmanaged" because the client uses it directly, not through ToolVault.
In ToolVault an unmanaged server is associated with exactly one client (the client where we discovered it).
Unmanaged servers can only be seen in the servers list for a client (never in the main servers list or in the add servers modal).
You can view details of an unmanaged server
- The configuration cannont be edited, there is no enable/disable, and no clients, messages or alerts tabs will be present
- Server details will be present, and you will be able to ping the server and test tools (for this we run the server in-situ, as the client would)

### Note: Client config rewriting

Rule 1: We don't want to change what the client calls a server, even if we change the config to point to a ToolVault managed server
- We want to avoid conflicts within the local client config servers namespace
- We want to preserve any other non-McpConfig data under that serverName key (some clients add tool permisions, etc)
- We don't know for sure that the client isn't using that name somewhere else for non-McpConfig data for that server
Rule 2: We don't want to change any server configuration values except the core mcpConfig server elements (type, command, args, env, url, headers)
- Some clients will store other data in the server config (things like tool permission configuration)
- We can't, for example, rewrite/overwrite the entire server config where it would lose any other existing metadata
Rule 3: When synchronizing servers to a client, the client should never have multiple instances of the same server (for example, a managed one and an unmanaged one)

Consider:
- Two Cursor projects use sqlite to talk to their respective databases (ie, configured differently)
- Each of them refers to it as "sqlite" in their mcp.json
- When we import them they will be different servers, served at different endpoints, with different serverName values
- Since we need to create unique names for managed servers, their managed server names will probaly be something like "sqlite" and "sqlite1"
- They will still be referred to in their internal configs as "sqlite" as before, but referencing "tsh [managedServerName]" (which may be different)
Or:
- Two cursor projects use "memory" with the same exact configuration
- One project calls it memboryFoo and the other one calls it memboryBar
- This results in one server being imported and pushed to both projects
- Each projects internal config uses the original servername and points to the same "tsh [managedServerName]"

Rule 1 above solves for both use cases
