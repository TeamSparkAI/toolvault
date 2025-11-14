# ToolVault Security Features (future)

Paper: [Enterprise-Grade Security for the Model Context Protocol (MCP): Frameworks and Mitigation Strategies](https://arxiv.org/html/2504.08623v1)

Another one: [MCP Vulnerabilities Every Developer Should Know](https://composio.dev/blog/mcp-vulnerabilities-every-developer-should-know)

## Features

### OAuth

- Docker examples: github, gdrive (figure out which specific servers these are, so we can test our auth)

- When MCP servers is the resource server: Authorization Code Grant with PKCE 
- When MCP servers is the client: Client Credentials Grant (maybe?)

### Secrets Management

- Ideally pluggable secrets manager (fallback to local secrets manager)
- Manage secrets under config, inject as if env var, maybe with "secrets." prefix?
- Client secrets from client app (Electron) - could use keychain or equiv (keytar) for local fallback
- For prod deployment, integrated with cloud or other key management systems (Vault, cloud provider secrets manager)
- Policy to detect managed secrets in payload (prevent leaking any internally defined secrets)
  - Will require something other than stored regex (maybe regex generated at application time by function)
  - How do we do this with real secrets manager?

### Prompt injection via MCP payloads

- Policy engine can try to handle some obvious cases, but for novel attacks we may need some AI or other detection

### Local TSL (shim to gateway)

### Network isolation

### Resources (container)

Specific usage (memory, CPU, etc), monitoring, rate limiting

### Message Processing

MCP Message validation
- Data type and format enforcement
- Length and range constraints
- Reject unknown fields (not defined in schema)

Integration with enterprise DLP solutions (via ICAP?)

Message tracing output to OpenTelemetry

### Policy actions

- Support list of actions in addition to content action
- Log to local security event log?
- Add report to SIEM (or other logging system)

### Environment separation (dev/prod)

- Secrets management will differ (local vs cloud)
- Auth creds will likely differ