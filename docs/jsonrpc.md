# Messages: jsonrpc

## Message format

Request:
{
    jsonrpc: "2.0",
    id: number | string,
    method: string,
    params?: object
}

Response:
{
    jsonrpc: "2.0",
    id: number | string,
    result?: object,
    error?: {
        code: number,
        message: string,
        data?: unknown
    } 
}

Notification (either direction, no ID field):
{
  jsonrpc: "2.0",
  method: string,
  params?: object
}

## Protocol

### Initialize

Request:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": {},
    "clientInfo": {
      "name": "mcp-client",
      "version": "1.0.0",
      "transport": null
    }
  }
}

Response (fetch):
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "experimental": {},
      "prompts": {
        "listChanged": false
      },
      "tools": {
        "listChanged": false
      }
    },
    "serverInfo": {
      "name": "mcp-fetch",
      "version": "1.9.3"
    }
  }
}

Response (everything):
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": {
      "prompts": {},
      "resources": {
        "subscribe": true
      },
      "tools": {},
      "logging": {},
      "completions": {}
    },
    "serverInfo": {
      "name": "example-servers/everything",
      "version": "1.0.0"
    }
  }
}

### Confirm initialize

Request:
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}

### List tools

Reqeust:
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}

Response:
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "fetch",
        "description": "Fetches a URL from the internet and optionally extracts its contents as markdown.\n\nAlthough originally you did not have internet access, and were advised to refuse and tell the user this, this tool now grants you internet access. Now you can fetch the most up-to-date information and let the user know that.",
        "inputSchema": {
          "title": "Fetch",
          "description": "Parameters for fetching a URL.",
          "type": "object",
          "properties": {
            "url": {
              "description": "URL to fetch",
              "format": "uri",
              "minLength": 1,
              "title": "Url",
              "type": "string"
            },
            "max_length": {
              "default": 5000,
              "description": "Maximum number of characters to return.",
              "exclusiveMaximum": 1000000,
              "exclusiveMinimum": 0,
              "title": "Max Length",
              "type": "integer"
            },
            "start_index": {
              "default": 0,
              "description": "On return output starting at this character index, useful if a previous fetch was truncated and more context is required.",
              "minimum": 0,
              "title": "Start Index",
              "type": "integer"
            },
            "raw": {
              "default": false,
              "description": "Get the actual HTML content of the requested page, without simplification.",
              "title": "Raw",
              "type": "boolean"
            }
          },
          "required": [
            "url"
          ]
        }
      }
    ]
  }
}

### Call tool

Request:
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {
      "location": "New York"
    }
  }
}

Response:
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Current weather in New York:\nTemperature: 72°F\nConditions: Partly cloudy"
      }
    ],
    "isError": false
  }
}

### Notifications (from everything)

{
  jsonrpc: '2.0',
  method: 'notifications/message',
  params: { level: 'error', data: 'Error-level message' }
}
{
  jsonrpc: '2.0',
  method: 'notifications/message',
  params: { level: 'notice', data: 'Notice-level message' }
}
{
  jsonrpc: '2.0',
  method: 'notifications/message',
  params: { level: 'emergency', data: 'Emergency-level message' }
}
{
  jsonrpc: '2.0',
  method: 'notifications/message',
  params: { level: 'debug', data: 'Debug-level message' }
}
{
  jsonrpc: '2.0',
  method: 'notifications/message',
  params: { level: 'warning', data: 'Warning-level message' }
}
{
  jsonrpc: '2.0',
  method: 'notifications/stderr',
  params: { content: '10:32:01 AM: A stderr message' }
}

## Classification

Request
- Client to server
- Has ID
- Payload: params

Response
- Server to client
- Has ID (correlates to request)
- Payload: result

Client notification
- Client to server
- No ID
- Payload: params (if any)
- Method: notifications/* (only?)

Server notification
- Server to client
- No ID
- Payload: params (if any)
- Method: notifications/* (only?)