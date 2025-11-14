# Support for Official Registry

https://github.com/modelcontextprotocol/registry

https://registry.modelcontextprotocol.io/docs

## Implement Internal Registry

We can implement the MCP pregistry protocol in our server (at a /registry endpoint, for example).

We then serve over than endpoint the list of installed/available servers installed in ToolVault
- The metadata will be from a combination of the original catalog/registry metadata and our own metadata
- The entries will contain a single remote the points at the hosted server (with the appropriate client id)

This would allow any client that spoke the MCP registry protocol and was capable of installing a registry to access the list of hosted MCP servers as sort of an "internal" registry and install them with one click.

This would involve ToolVault allowing clients to access servers via token without pre-install, and some kind of sync mechanism to pick up the changes.
- Maybe the first time a client accesses an server that we don't have installed for the client we do a sync?
- Also, not all clients will be capable of sync
  - Add clients that we see in use by client (if not syncable?)

## TODO

Registry item detail - Show all config details in runtimeArguments, packageArguments, and headers
Guided config UX (default values, types, required, descriptions, etc)

Figure out scheme for ToolVault servers (in db) to support both registry servers and catalog servers
- Consider that in future we could support arbitrary registries via configuration (so it might not just be one registry, or not just the default registry)

Can we make our catalog available via the registry API
- name wouldn't meet spec (verified reverse DNS) - could we work around this using registry / repo?
- If we convert our sample config into packageArguments they won't have any real metadata or documentation

When no configuration/env/headers
- "No configuration information provided, see package registry or repository for details on configuring this server"

## Issues

The notion of versions in the MCP registry is interesting.  Just because a server says it is version x.y doesn't mean that version x.y is the latests version in the package registry (or that it is in the package registry at all).  The package registry is really the single source of truth for what versions are installable.

Also, I think it is highly likely that people will publish new npm/pypi registry versions of their servers without updating the MCP registry (this will certainly happen some of the time, but may happen most of the time, or at least very often).  At very least there will be some potential lag if the MCP registry is updated at the same time or after the fact (given the periodic polling type of update of MCP registry clients).

This begs the question, when we create a ToolVault server from an MCP registry server, do we link it back to the serverId, the versionId, or both?

Consider also that when pinning, we allow the user to choose any version available from the package registry (which may well not line up with the MCP registry versions available).

When looking up an MCP registry server from a ToolVault server we should get servers by serverId, then:
- If pinned, get the latest version that is not greater than the pinned version
- Else get the latest version
Consider that to be the "best" version to provide metadata and drive configuration

Idea: On new server, see if MPC registry version is available in package registry, and if so, pin to that version, else float

## Data

See: registry-openapi.yml
Downloaded from: https://registry.modelcontextprotocol.io/openapi.yaml
As referenced in: registry/docs/reference/api/official-registry-api.md

Here is a much more detailed (and better structured) OpenAPI yaml file:

https://github.com/modelcontextprotocol/registry/blob/76365a61e3660ba4bb1052bbc1289d9475b50d12/docs/reference/api/openapi.yaml
Which is referenced from registry/docs/reference/faq.md

Also see: https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/generic-server-json.md 

GET https://registry.modelcontextprotocol.io/v0/servers

Servers can contain remotes (hosted endpoints) and/or packages (downloadable/runnable/local servers)

# Registry support

User can add registry
- We default to starting with registry.teamspark.ai installed

Registry menu -> registry browse/search page

Server detail page
- Change "Configure" to "Install", on OK, add as managed server
- Can we install more than one instance?
  - For catalog remote/transport, do we show that there are existing installs, how would we link to them (esp if more than one)?
  - Maybe we just list existing with "Add another instance" (or something) when there are existing

In DB, we want to correlate server entry to catalog/registry (for server metadata and package/remote config info)
- Registy: Need types/ID of registry (maybe registry ID is just URL)
  - registry::https://registry.teamspark.ai
- Item: need indicator of which item and which package/transport
  - Form natural key
    - name + version + package + registryType (registryBaseUrl, default by type?) + identifier
    - name + version + remote + type + url

Maybe this is just one json field:
{
    "sourceType": "registry",
    "sourceId": "https://registry.teamspark.ai",
    "serverId": "com.foo.coolServer",
    "serverVersion": "1.0.0",
    "installedPackage": {
        "registryBaseUrl": "https://registry.npmjs.org",
        "identifier": "@publisher/packageName"
    }
}

Or "installedRemote"

Note: I think we've alread implemented some of the below (see actual and update doc)

Should we store the server.json objects correlated to installed servers (so we have access to their config)? Or do we just store the entire package/remote, which contains the config?

Maybe we store the entire server.json, except that we remove the packages/remotes that the user didn't install?  That way we have all of the metadata we'd need about the server and the installed package/remote (and an unambiguous way to reference the installed package/remote, since there would only be one).  
- Eliminates need for natural key / ability to correlate to original server.json package/remote (if we did need to, we have all the config data)
- This assumes that the server is in server.json form
  - We'd need to update our catalog to support the official registry format, or remove support for it
  - Assumes that the server.json from the mcp registry is the same as the server card (currently seems like a safe bet)

For installed server from registry
- We can use server.json form to install AND to edit in future
  - This means we need to be able to parse mcpConfig server entry into data fields

Need to ability to switch to "raw" mode (existing config interface)
- If server has no config spec, just go to raw mode
- Allow user to manually elect to go to raw mode (esp for when config spec is incomplete/broken)

If a user wanted to link back to the catalog, we'd attempt to download the catatlog server.json - what if that fails?

# ServerCard support

Assuming the ServerCard SEP gets approved/implemented, the user may enter any URL and we should look there for a server card indicating MCP servers published by the owner of that URL. For example, if the user says to look at "github.com" and we find a server card, we should show the server(s) as with a catalog entry and allow the user to install a selected package or remote.  We need to link back to that "source" - maybe:

{
    "sourceType": "ServerCard",
    "sourceId": "https://github.com",
    "server": {
        ...
    }
}
