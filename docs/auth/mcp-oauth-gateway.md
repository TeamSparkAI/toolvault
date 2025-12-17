## OAuth for our MCP Gateway (MCP-spec-aligned)

This document describes how OAuth-based authorization works when we introduce an **MCP Gateway** between an MCP client and **multiple upstream MCP servers**, using MCP’s authorization approach (OAuth challenges + metadata discovery).

## Overview (the picture to keep in your head)

We have three primary actors (**MCP Client**, **Gateway**, **Upstream MCP servers**) and potentially **multiple Authorization Servers**:

```text
MCP Client  -------------------- Auth Code + PKCE -------------------->  AS_GW (OAuth/OIDC)
   |
   | MCP using Authorization: Bearer <token-for-gateway>
   v
Gateway (Protected Resource + token broker)
   |
   +--> Upstream Server A (Protected)   ---- Auth Code + PKCE (grant) ---->  AS_A (OAuth/OIDC)
   |        ^
   |        | MCP using Authorization: Bearer <token-for-A>
   |
   +--> Upstream Server B (Protected)   ---- Auth Code + PKCE (grant) ---->  AS_B (OAuth/OIDC)
            ^
            | MCP using Authorization: Bearer <token-for-B>

   ... repeats per upstream server (C, D, ...)
```

There are **two distinct authorization relationships**:

- **Client → Gateway authorization** (optional, but common):
  - The Gateway acts as an OAuth **Protected Resource** (resource server).
  - The client obtains an access token from the Gateway’s Authorization Server and calls the Gateway with `Authorization: Bearer <token>`.

- **Gateway → Upstream Server authorization** (per upstream server, when required):
  - Each upstream MCP server may be its own OAuth Protected Resource and may use its **own** Authorization Server.
  - The Gateway must obtain and manage **per-user, per-upstream-server grants/tokens** and forward upstream requests with the appropriate upstream access token.

In both cases, MCP relies on **standards-based discovery**:
the protected resource returns `401` with `WWW-Authenticate` including a `resource_metadata` URL (RFC 9728), which leads the client to the relevant Authorization Server metadata (RFC 8414), and then the client runs Authorization Code + PKCE.

## Terminology

- **MCP client**: an agent/app that speaks MCP (often a public client).
- **Gateway**: an MCP “server” to the client, and a client/proxy to upstream MCP servers.
- **Upstream MCP server**: the real tool server behind the gateway.
- **Authorization Server (AS)**: OAuth/OIDC issuer used by the gateway or an upstream server.
- **Protected Resource**: the gateway (for user→gateway auth) or an upstream server (for user→server auth).

## What makes this “MCP OAuth” (vs generic OAuth)

MCP’s authorization model is “standard OAuth, with standardized *challenge* + *discovery* behaviors”:

- **401 + `WWW-Authenticate` that points to Protected Resource Metadata (PRM)**  
  A protected resource that requires OAuth responds to unauthenticated requests with `401` and a `WWW-Authenticate` challenge that includes a **`resource_metadata`** parameter (defined in **RFC 9728**).

- **Protected Resource Metadata (PRM) discovery** (**RFC 9728**)  
  Clients fetch a JSON PRM document from a deterministic well-known location (commonly `/.well-known/oauth-protected-resource`, with path rules for multi-resource/multi-tenant per RFC 9728).

- **Authorization Server metadata discovery** (**RFC 8414**)  
  PRM tells the client which AS(es) to use; the client then fetches AS metadata (authorization endpoint, token endpoint, JWKS URI, etc.).

- **OAuth Authorization Code + PKCE (recommended for MCP clients)**  
  MCP guidance uses **Authorization Code with PKCE** for user-interactive flows (public clients).

- **Resource indicators / audience restriction** (**RFC 8707**)  
  Clients should request tokens bound to the intended resource using the OAuth `resource` parameter; the resource server validates that the token is meant for it.

- **Optional Dynamic Client Registration (DCR)** (**RFC 7591**)  
  Useful when MCP clients aren’t pre-registered, but should be tightly controlled in enterprise deployments.

## Standards referenced

- **RFC 9728**: OAuth 2.0 Protected Resource Metadata — [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728)
- **RFC 8414**: OAuth 2.0 Authorization Server Metadata — [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414)
- **RFC 8707**: Resource Indicators for OAuth 2.0 — [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707)
- **RFC 7591**: OAuth 2.0 Dynamic Client Registration — [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591)
- **MCP guidance**: Understanding Authorization in MCP — [MCP authorization tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization)

---

## 1) User/client authentication to the MCP Gateway

The gateway behaves as an OAuth-protected MCP server.

### 1.1 Challenge + discovery

1. The client calls a protected gateway endpoint (e.g., MCP HTTP transport) **without** an access token.
2. The gateway responds:

- HTTP status: **`401 Unauthorized`**
- Header: **`WWW-Authenticate`** including **`resource_metadata="…"`** pointing to the gateway’s PRM URL.

Example (illustrative):

```text
WWW-Authenticate: Bearer realm="toolvault", resource_metadata="https://gateway.example/.well-known/oauth-protected-resource"
```

3. The client fetches the PRM document (JSON).
4. From PRM, the client discovers the AS and fetches **AS metadata** (RFC 8414).

### 1.2 Authorization Code + PKCE (user-interactive)

5. The client starts OAuth at the AS authorization endpoint with:
- `response_type=code`
- PKCE: `code_challenge`, `code_challenge_method=S256`
- `state` (CSRF protection)
- `scope` (gateway-defined scopes; see “Scopes” below)
- `resource=<canonical gateway resource identifier>` (RFC 8707)

6. The AS redirects back to the client with `code`.
7. The client exchanges `code` for tokens at the AS token endpoint, including `code_verifier`.

### 1.3 Using the token

8. The client calls the gateway with:

```text
Authorization: Bearer <access_token>
```

9. The gateway validates and authorizes:
- Signature/JWKS verification, expiration, issuer
- **Audience/resource restriction**: token must be minted for the gateway (RFC 8707)
- Scopes/claims sufficient for the requested MCP operation

### 1.4 Sessions are not credentials

If the MCP transport uses a session identifier (e.g., `Mcp-Session-Id`), the gateway treats it as **untrusted state**, not as an authorization mechanism; authorization is tied to validated tokens.

---

## 2) User/client authentication through the Gateway to upstream OAuth-protected MCP servers

The gateway acts as a **token broker / connection manager**: the client authenticates to the gateway, and the gateway manages per-upstream OAuth grants/tokens for the user.

### Client experience

- Client always presents a **gateway token** to call the gateway.
- If the user hasn’t authorized upstream server **S** yet, the gateway returns **`401` + `WWW-Authenticate … resource_metadata="…"`** pointing to a PRM for “authorize/connect upstream S”.

### Flow (per upstream server S)

1. Client requests an operation that routes to upstream server **S** (e.g., tool invocation).
2. Gateway sees no stored grant for `{user, S}` and responds with a challenge (401 + `resource_metadata`).
3. Client follows PRM → AS metadata → performs Authorization Code + PKCE for **S** (or for a gateway-managed federation AS, depending on deployment).
4. Upon success, the gateway stores the resulting grant (typically refresh token), encrypted and access-controlled, keyed by:
- user identity (from gateway token)
- upstream server identifier S
- issuer/tenant (to prevent mix-ups)
5. Gateway obtains short-lived upstream access tokens as needed and forwards to S with:

```text
Authorization: Bearer <upstream_access_token>
```

### Why this fits a gateway

- Avoids the “only one `Authorization` header” problem.
- Centralizes auditing, policy enforcement, rate limiting, and credential storage/rotation.
- Allows consistent UX: one login to gateway, plus “connect upstream” experiences when needed.

### Security notes

- Store tokens securely (encrypt at rest, strict access control).
- Never log credentials or `Authorization` headers.
- Pin issuers/tenants; prevent realm/tenant mix-up.
- Ensure tokens are audience/resource restricted for the correct upstream resource (RFC 8707).

---

## Scopes and authorization model

Define gateway scopes that map to MCP capabilities, for example:

- `mcp:tools:list`
- `mcp:tools:invoke`
- `mcp:resources:list`
- `mcp:resources:read`
- `mcp:prompts:list`
- `gateway:admin` (server management / policy)

The gateway should enforce:

- **Policy-level authorization** (is user allowed to access upstream server S at all?)
- **Capability-level authorization** (is user allowed to invoke tool T / read resource R?)

Even if upstream tokens are broader, the gateway should still apply least-privilege policy at the MCP method/tool level.

---

## What the Gateway must implement for MCP-style OAuth interoperability

- **Correct 401 challenge behavior**:
  - `WWW-Authenticate` including `resource_metadata` so clients can discover how to authenticate (RFC 9728).
- **PRM endpoints**:
  - PRM for the gateway itself.
  - PRM per upstream “connection” (i.e., “connect/authorize server S via the gateway”).
- **OAuth discovery compatibility**:
  - Support RFC 8414 AS metadata discovery and Authorization Code + PKCE.
- **Resource indicator support**:
  - Encourage/use `resource` on authorization, validate audience/resource on receipt (RFC 8707).
- **Token validation and handling best practices**:
  - Validate issuer, signature/JWKS, expiry, and audience/resource; don’t log secrets; use short-lived access tokens; protect refresh tokens.


