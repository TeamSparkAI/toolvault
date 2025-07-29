# Tool Vault Installation

There are three components require for a working Tool Vault setup

1. The teamspark/mpc-runner container

```bash
cd projects/docker
docker build -t teamspark/mcp-runner .
```

2. The Tool Vaul "shim" - tsh

```bash
cd projects/proxy
npm run build
npm install -g
```

3. The Tool Vault server

```bash
cd projects/server
npm run build && npm run start
```