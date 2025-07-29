# MCP Proxy

A Node.js proxy server that emulates an MCP server and proxies to another MCP server.

It presents as a Stdio, SSE, or Streamable MCP server, and it forwards to a Stdio, SSE, Streamable, or Stdio-Container MCP server.

## Setup

1. Install dependencies:
```bash
cd src/proxy
npm install
```

2. Create a `.env` file in the proxy directory:
```bash
cd src/proxy
cp .env.example .env
```

3. Configure your environment variables in `src/proxy/.env`:
- `PORT`: The port the proxy server will run on (default: 3000)
- `CONTAINER_TYPE`: The type of container to connect to (`sse` or `stdio`)
- `CONTAINER_NAME`: The name of the container (required for stdio containers)
- `CONTAINER_ENDPOINT`: The endpoint URL for SSE containers (required if `CONTAINER_TYPE` is `sse`)

Example for stdio:
```bash
PORT=3000
CONTAINER_TYPE=stdio
CONTAINER_NAME=fetch
```

Example for SSE:
```bash
PORT=3000
CONTAINER_TYPE=sse
CONTAINER_ENDPOINT=http://container:8080
```

## Usage

Start the proxy server from the proxy directory:
```bash
cd src/proxy
npm start
```