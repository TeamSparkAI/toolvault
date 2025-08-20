# ToolVault Security Features (future)

Paper: [Enterprise-Grade Security for the Model Context Protocol (MCP): Frameworks and Mitigation Strategies](https://arxiv.org/html/2504.08623v1)

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
  - How do we so this with real secrets manager?

### Server version control ("Pinning")

- Pin app (esp npx/uvx) to current version
- Alert on new version
  - Diff serverInfo and tool catalog (tools/descriptions)
  - Auto-migration (if serverInfo same except version, tool catalog same)
  - Manual migration
    - Alert new server available (general info level, non-policy "system alert")
    - Allow test
    - Push-button migration (revert?)

- For npx/uvx - implement command to get "latest" (use this for pinning and determining if new version avail)
  - Introspect new version (run wrapped in container if deployed server is wrapped) to  determine what, if anything, has changed

### Malicious tool description

- For both serverInfo (initialize response) and tool descriptions (list/tools response)
- Policies should be able to handle malicous content reasonably well
  - How many of the malicious content filters should just apply all server messages?
- AI-powered detection (looking for semantic inconsistenty, novel tool poisoning)
- Misleading content is trickier (where attack is to get agent to call server's tools instead of more appropriate tools to capture info)
  - This is probably better handled by user inspecting tools/tool description on install/upgrade (with pinning and explicit upgrade)
- Should we record tools/descriptions and compare later executions to see if they match (especially if pinned)
  - If tools or descriptions change, info level event
  - If tools or descriptions change for the same serverInfo version, error level event?  Esp if pinned. Other action?
- This implies a mechanism of system/server level security events not related to policies (should we generalize alerts for this?)

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