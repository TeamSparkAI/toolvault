# Security Validation

The security validation feature allows you to check for available updates to MCP servers and validate them without permanently updating the server configuration. This is useful for security workflows where you want to test updates before applying them to production servers.

## Overview

The security validation system:

1. **Extracts package information** from existing server configurations (both wrapped and unwrapped)
2. **Checks for updates** in the appropriate package registry (npm or PyPI)
3. **Runs the updated version** in the same configuration as the original server
4. **Interrogates the updated server** to get its server info and tools
5. **Returns validation results** without modifying the original server

## API Endpoint

### POST `/api/v1/servers/{serverId}/validate`

Validates a server for available updates and tests the updated version.

**Parameters:**
- `serverId` (path): ID of the server to validate

**Response:**
```json
{
  "meta": {
    "apiVersion": "1.0",
    "status": 200,
    "message": "Success"
  },
  "validation": {
    "hasUpdate": true,
    "currentVersion": "1.0.0",
    "latestVersion": "1.2.0",
    "serverInfo": {
      "name": "mcp-fetch",
      "version": "1.2.0"
    },
    "tools": [
      {
        "name": "fetch",
        "description": "Fetch a URL",
        "inputSchema": { ... }
      }
    ],
    "validationTime": "2024-01-15T10:30:00.000Z"
  }
}
```

## Supported Server Types

The security validation works with:

- **npm packages** (npx commands)
- **PyPI packages** (uvx commands)
- **Wrapped servers** (running in containers)
- **Unwrapped servers** (running directly)

## Examples

### Unwrapped npm server
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-fetch@1.0.0"]
}
```

### Wrapped PyPI server
```json
{
  "type": "stdio",
  "command": "docker",
  "args": ["run", "--rm", "-i", "teamspark/uvx-runner:latest", "uvx", "mcp-server-fetch==1.0.0"]
}
```

## Usage Workflow

1. **Identify servers** that need security updates
2. **Call the validation endpoint** to check for updates
3. **Review the results** to see what tools and capabilities the updated version provides
4. **Apply updates** manually if the validation is successful

## Error Handling

The endpoint returns appropriate error responses:

- `400`: Invalid server ID or unsupported configuration
- `404`: Server not found
- `500`: Internal server error or validation failed

## Implementation Details

The security validation leverages existing infrastructure:

- **Package extraction**: Uses `PackageExtractionService` to parse server configurations
- **Update checking**: Uses `packageInfoService` to check for available updates
- **Container execution**: Uses existing Docker runner containers and wrapping utilities
- **MCP communication**: Uses `McpClientStdio` for server interrogation

## Security Considerations

- **Isolated execution**: Updated servers run in the same container isolation as existing servers
- **Temporary execution**: No permanent changes are made to server configurations
- **Proxy support**: Inherits existing npm/PyPI proxy configuration for secure package access
- **Automatic cleanup**: Containers are automatically cleaned up after validation
