# Support for Official Registry

https://github.com/modelcontextprotocol/registry

https://registry.modelcontextprotocol.io/docs

## Data

See: registry-openapi.yml

Get from: https://registry.modelcontextprotocol.io/v0/servers

Servers can contain remotes (hosted endpoints) and/or packages (downloadable/runnable/local servers)

remotes: [
    {
        "type": "sse",
        "url": "https://mcp.ai.teamwork.com",
        "headers": [
            {
                "description": "API key generated from the Teamwork.com OAuth2 process: https://apidocs.teamwork.com/guides/teamwork/app-login-flow",
                "isRequired": true,
                "isSecret": true,
                "name": "Authorization"
            }
        ]
    },
    {
        "type": "streamable-http",
        "url": "https://mcp.ai.teamwork.com",
        "headers": [
            {
                "description": "API key generated from the Teamwork.com OAuth2 process: https://apidocs.teamwork.com/guides/teamwork/app-login-flow",
                "isRequired": true,
                "isSecret": true,
                "name": "Authorization"
            }
        ]
    }
]

packages: [
    {
        "registryType": "npm",
        "registryBaseUrl": "https://registry.npmjs.org",
        "identifier": "@kirbah/mcp-youtube",
        "version": "0.2.6",
        runtimeHint: "npx", // uxv, node, bun, docker, dnx, python
        "transport": {
            "type": "stdio"
        },
        "packageArguments": [
            {
                "value": "mcp",
                "type": "positional",
                "valueHint": "mcp"
            },
            {
                "value": "start",
                "type": "positional",
                "valueHint": "start"
            }
        ],
        "environmentVariables": [
            {
                "description": "YouTube Data API v3 key",
                "isRequired": true,
                "format": "string",
                "isSecret": true,
                "name": "YOUTUBE_API_KEY"
            },
            {
                "description": "MongoDB connection string for caching",
                "format": "string",
                "isSecret": true,
                "name": "MDB_MCP_CONNECTION_STRING"
            }
        ]
    }
]

## Absence of configuration data

I have an MCP security product called TeamSpark MCP ToolVault that has a catalog of MCP servers that users can choose from (the catalog is something crude that I rolled myself by scraping the Official servers page and the associated GitHub README files to find sample configs).  It's open sourced here: https://github.com/TeamSparkAI/ToolCatalog (though I expect it will go away in favor of a mildly curated version of the official registry).

One area where the official registry is a huge improvment is in the support for metadata-driven configuration (versus the "sample-based" configuration I'm using now and most users are used to seeking out in a registry/repository and copy-pasting).

With this metadata-driven configuration we have an ideal situation where the user selects a server and we can give them a guided configuration experience using the specified configuration elements and their properties (as if the MCP server implemented it's own custom config UX).  This is extremely well designed in the spec and results in a great experience when it is present in the server definition.  Chef's kiss.  No notes.

The issue we have run into in deploying this in our UX is that only about half of the server packages and remotes in the current registry provide any kind of configuration information.  I have spot-checked about two dozen of the servers that do not provide configuration, and in all cases they actually do require configuration to run properly (these are back to the old "go look at the README in the registry/repo and find a server config JSON to copy/paste").

My initial reaction was that we would just treat the abscence of configuration as "no configuration specified" instead of "no configuration required" (our initial naive aproach).  This is probably fine, except that there might be well-managed entries for servers that actually don't require any config (like the sample "memory" server, or an internal remote that requires no headers).  I'd hate to punish a server that actually required no config.  I wonder if providing an empty config (arguments/env var/headers) would be the proper way to indicate that those configuration elements are explicitly not required (versus just not provided by the publisher)?

My other observation is that the [Publish Your MCP Server]
(https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/publish-server.md) doc does not provide guidance about specifying package configuration.  Though it does provide guidance for providing headers for remotes.  I'm not sure how much that guidance would help given that it's provided for the remote headers and those have about the same participation rate.  But it couldn't hurt to add it.

I'm new here and didn't want to rush in with an issue or PR without having the full context, so I figured it would be better to post here.

Current servers: 630

Packages: 380 (54% specify some form of configuration - packageArguments or environmentVariables)

Remotes: 356 (53% specify headers)

Publish Your MCP Server
https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/publish-server.md

Does not provide any guidance about providing package configuration.  It does provide guidance for providing headers for remotes.

In spot checking of a couple dozen packages and remotes without configuraiton, none of them were valid without configuration.