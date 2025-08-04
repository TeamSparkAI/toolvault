# ToolVault Docker 

The Dockerfiles in this project are for running npx or uvx MCP servers in generic containers

To build it:

```bash
docker build -t teamspark/mcp-runner .
```

To run an MCP server:

```bash
docker run --rm -it teamspark/mcp-runner npx -y @modelcontextprotocol/server-everything
```