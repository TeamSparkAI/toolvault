# Tool Vault Docker 

The Dockerfile in this project is for running npx or uvx MCP servers in a generic container

To build it:

```bash
docker build -t teamspark/mcp-runner .
```

To run an MCP server:

```bash
docker run --rm -it teamspark/mcp-runner npx -y @modelcontextprotocol/server-everything
```