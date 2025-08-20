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
  - How do we do this with real secrets manager?

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
  - Introspect new version (run wrapped in container if deployed server is wrapped) to determine what, if anything, has changed
  - We can't rely on version information in the MCP server (it's not metadata, it's provided over the protocol at runtime and could change for a malicious server)

#### Pinning Workflow

- If a server is unpinned (using @latest), then it essentially has no current version.  So when pinning, we get the @latest version,
  store it as the pinned version, then on all subsequent invocations we apply the pinned version.  This is the simpllest possible 
  standalone pinning solution that adds value (though it does not protect against dynamic server/tool description attacks without
  the workflow below).
  
- We need a pinning workflow where we show the latest version info (from package repo), the serverInfo, and tools with descriptions,
  for the user to review and approve.  On approval we store all of the reviewed info (package version, server info, and all tools/details).  
  
- During server usage we review content for compliance to pinned content (we ensure that serverInfo matches on initialize and we ensure
  that tool data matches on tools/list).
  
- We allow the user to check if a new version of a pinned server is available, and if so, they can start the pinned version upgrade from 
  there.  We could also periodically check the server repo to see if a new version is available and provide an alert of some kind to notify
  the user (if so, and auto-update enabled, and no signficant changes, we could auto update the pinned version).

- For the upgrade, we analyze the new version (meaning we have to run the server and talk to it somehow) to determine if there are changes
  that need review (serverInfo or tools/descriptions).
  - If not, we could auto-update or present a push button pinned version update (essentially, server info and tools unchanged).
  - If there are any differences, we need to provid an alert and a workflow for the user to review the specific changes and approve/disapprove.

### Malicious tool description

- Covers both serverInfo (initialize response) and tool descriptions (list/tools response)
  - These are dynamic information provided over the protocol and which could change with a malicious server
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