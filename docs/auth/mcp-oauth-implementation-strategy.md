## MCP OAuth implementation strategy (phased rollout)

This document proposes an implementation plan for adding MCP-spec-aligned OAuth authorization to our MCP Gateway in phases:

- **Phase 1**: OAuth-protect the **Gateway itself** (client → gateway).
- **Phase 2**: Add OAuth brokering for **upstream MCP servers** behind the gateway (gateway → upstream, per server, per user).
- **Phase 3**: Hardening + enterprise features (policy, audit, rotations, optional advanced OAuth features).

This plan assumes the architecture described in `docs/auth/mcp-oauth-gateway.md`.

---

## Goals

- **Spec-aligned discovery**: On `401`, return `WWW-Authenticate` with `resource_metadata` so MCP clients can discover how to authenticate (per RFC 9728).
- **Standard OAuth flow**: Authorization Code + PKCE for user-interactive authorization.
- **Match our client config reality**: we configure **one MCP client server entry per upstream server** (no aggregation). In OAuth mode, plan for user auth potentially being initiated per entry (even if tokens can sometimes be reused/cached).
- **Secure token handling**:
  - Validate all tokens (issuer, signature/JWKS, expiry, audience/resource binding).
  - Never log secrets/tokens/authorization codes.
  - Store long-lived credentials (refresh tokens) encrypted with tight access control.
- **Gateway as broker**: Support multiple upstream MCP servers, each potentially with its own Authorization Server, by brokering per-user grants and forwarding server-specific access tokens.

## Non-goals (initially)

- Supporting every OAuth extension on day 1 (DPoP, mTLS, token exchange) unless required by target upstream servers.
- Multi-tenant “bring your own issuer” without explicit design and strong isolation.

---

## What configuration/data we need to store

This section is focused on the **concrete config/database data** we will need to “hook up” to an Authorization Server and to support upstream OAuth brokering.

### 0) User records, roles, and web console auth (multi-user foundation)

To make the gateway truly multi-user, we need a durable **user record** and consistent authorization rules across the API and web console.

#### User identity key

We assume a **single Authorization Server per gateway deployment**. A user’s stable identity should be derived from the validated gateway OAuth JWT:

- **`issuer`**: token `iss`
- **`subject`**: token `sub`

We should treat `(issuer, subject)` as the canonical external identity key.

#### Users table (recommended fields)

- `user_id` (internal primary key)
- `issuer` (OAuth `iss`)
- `subject` (OAuth `sub`)
- (optional) `email`, `display_name` (profile metadata)
- `role` (`admin` | `user`)
- `created_at`, `last_login_at`, `disabled_at` (optional)

#### User provisioning (how users get created/linked)

We need a clear policy for creating users:

- **JIT provisioning (recommended initially)**: on first successful OAuth-authenticated request, if `(iss, sub)` is unknown, create the user record.
- **Admin bootstrap**: we must define how the first `admin` is assigned (e.g., env-configured allowlist by email/domain, or explicit bootstrap config).

#### Securing the web console

Today the web console is effectively open. In a multi-user system:

- require OAuth authentication for the UX
- enforce authorization at the API layer, not only in the UI
- apply RBAC:
  - **admin** can manage users and view all data
  - **user** can only view/modify their own data (by ownership)

### 0) Client records (single-user ownership)

We assume **each client is owned by a single user**. Even if we continue to use long-lived `clientToken` secrets for packaging/selection, when OAuth is enabled we should treat the OAuth user as authoritative and enforce that:

- the authenticated OAuth user **owns** the referenced client, and
- the client’s client↔server mappings constrain what the user can access (packaging + access control).

**Recommended stored fields (per client):**

- `client_id` (existing)
- `client_token` (existing long-lived secret; stored securely)
- `owner_issuer` + `owner_subject` (OAuth `iss` + `sub`) **or** `owner_user_id` (internal user id derived from OAuth)
- (optional) `token_rotated_at`, `last_used_at`

### 1) Gateway auth (Phase 1): resource-server configuration

For gateway authentication, the gateway acts as an OAuth **Protected Resource** (resource server). That means we must store enough configuration to:

- publish discovery (`WWW-Authenticate` + PRM), and
- validate tokens issued by our chosen Authorization Server.

**Recommended stored fields (per gateway deployment):**

- **Gateway identity**
  - `gateway_public_base_url`: canonical public URL clients use to reach the gateway (used when constructing PRM URLs and canonical resource identifiers)
  - `gateway_resource_identifier`: the resource/audience value we require tokens to be minted for (RFC 8707 concept)

- **Authorization server trust**
  - `auth_issuer`: the issuer URL we trust (must match token `iss`)
  - `auth_metadata_url` (optional): override for RFC 8414 / OIDC discovery URL (normally derived from issuer)
  - `jwks_uri` (optional): override (normally discovered)
  - `allowed_signing_algs` (optional): e.g. `["RS256"]`

- **Authorization mapping**
  - `required_scopes_by_capability`: mapping of MCP operations to required scopes (e.g., list tools vs invoke tools)
  - `subject_claim` (optional): where we read the user id from (e.g., `sub`)
  - `scope_claim` (optional): where we read scopes from (commonly `scope`)

**Auth0 mapping (Phase 1):**

- `auth_issuer`: Auth0 issuer for the tenant/custom domain (must match `iss`)
- `gateway_resource_identifier`: Auth0 “API Identifier” (commonly appears in `aud`)
- `jwks_uri`: typically via OIDC discovery (no manual config required unless we want to pin)

### 2) Upstream server auth (Phase 2): upstream connection configuration

To broker OAuth for upstream MCP servers, we need a **connection record per upstream server**. Each record must provide:

- how we reach the upstream server,
- whether it requires OAuth, and
- enough OAuth details for the gateway to obtain/refresh server-specific tokens on behalf of a user.

**Recommended stored fields (per upstream server connection):**

- **Server identity/routing**
  - `server_id` (stable identifier)
  - `server_display_name`
  - `server_base_url`

- **OAuth requirements**
  - `requires_oauth`: boolean
  - `upstream_resource_identifier` (audience/resource we must request tokens for, if applicable)
  - `upstream_scopes`: list/string of scopes we request for this upstream connection

- **Upstream Authorization Server discovery**
  - `upstream_auth_issuer` (preferred) or `upstream_auth_metadata_url` (override)
  - `upstream_jwks_uri` (optional): override (normally discovered)

- **Gateway-as-client registration (needed for brokering)**
  - `oauth_client_id`
  - `oauth_client_secret` (for confidential clients; stored encrypted/secret-managed)
  - `oauth_redirect_uri`: where the upstream AS will redirect back to the gateway to complete the code flow
  - `oauth_use_pkce`: boolean (recommend true even for confidential clients)

### 3) Per-user upstream grants (Phase 2): what we store in the database

To call upstream servers on behalf of a user, the gateway will need to store **per-user, per-upstream-server grants**.

This must support multiple users authorizing the same upstream server independently (i.e., separate grants per `(user, server)`).

**Recommended stored fields (per user + upstream server + issuer/tenant):**

- `user_id` (internal user identifier from the gateway’s own auth)
- `server_id`
- `issuer` / `tenant_id` (pinning to avoid realm/tenant mix-ups)
- `granted_scopes` (what we actually obtained)
- `refresh_token_encrypted` (if issued)
- `refresh_token_issued_at` (optional)
- `access_token_cached_encrypted` (optional short-lived cache)
- `access_token_expires_at` (for cache validity)
- `revoked_at` (if the user disconnects)
- `last_refresh_at` / `last_error` (operational visibility; avoid leaking sensitive detail)

**Security requirements for stored grants:**

- encrypt refresh tokens at rest (envelope encryption or KMS-backed)
- strict access controls (only the gateway service)
- never log token values

### 4) OAuth transaction state (Phase 2): temporary state we may need

If the gateway is terminating OAuth callbacks for upstream authorization, we will likely need short-lived state storage for the login/consent round-trip:

- `state` (CSRF)
- PKCE `code_verifier` (if gateway is the OAuth client using PKCE)
- selected `server_id`
- `user_id`
- `redirect_after_connect` (where to send the user/client after connecting)
- `created_at` / `expires_at`

This state should have a short TTL and be single-use.

---

## Phase 0 — Prerequisites / design decisions (short)

Before building, we should decide:

- **Gateway resource identifier**: canonical `resource` value we will require (RFC 8707).
- **Client configuration model**: we do **not** aggregate multiple upstream servers into one logical MCP server; we will publish/configure one entry per upstream server and should assume OAuth UX may repeat per entry depending on client behavior.
- **Issuer strategy**:
  - Single Authorization Server for gateway auth, or multiple (enterprise).
  - How we map upstream servers to issuers/tenants.
- **Token format**: **JWT access tokens** (validated via JWKS; we are not planning to support opaque/introspection initially).
- **Scope model**: the minimal scope vocabulary for MCP capabilities (tools/resources/prompts) and admin actions.
- **Redirect/callback UX**:
  - If the MCP client is a desktop app/agent, how the user completes the browser step.
  - Whether we provide a “Connect upstream server” page in the gateway UI.
- **Transport strategy for OAuth-to-gateway**:
  - If we require OAuth for the MCP gateway endpoint, clients must connect via an HTTP transport (**SSE** or **streamable HTTP**) so they can follow `401` challenges and perform PKCE.
  - Stdio shims (`tsh`) work today because they do an out-of-band call to mint an internal bearer token; in OAuth-to-gateway mode we should expect clients to connect directly via HTTP (or accept that a shim must become OAuth-capable).

Deliverable:
- A short “OAuth configuration contract” describing required config fields for gateway AS and each upstream AS.

---

## Phase 1 — OAuth-protect the Gateway (client → gateway)

### Scope

Implement the gateway as an OAuth **Protected Resource** (resource server) for MCP calls.

### Key capabilities

- **Protected Resource Metadata (PRM) endpoint for the gateway**
  - Publish gateway PRM at a deterministic URL (RFC 9728 well-known conventions).
  - Include pointers needed for clients to discover the gateway’s AS metadata (RFC 8414).

- **Correct 401 challenges**
  - For unauthenticated requests, respond `401` with `WWW-Authenticate` including `resource_metadata="<gateway PRM URL>"`.

- **Token validation middleware**
  - Validate signature (JWKS), expiry, issuer.
  - Validate that token is intended for the gateway (audience/resource binding; RFC 8707).

- **Client/server selection in OAuth mode (no out-of-band proxy JWT)**
  - For MCP over SSE/streamable, accept `clientId` and `serverId` (or equivalent identifiers) as untrusted selectors (headers or query params) in the MCP server config.
  - Treat these selectors as **payload**, not secrets, and authorize them by checking:
    - the OAuth user owns the referenced client
    - the client is allowed to access the referenced server (client↔server mapping / strict access)
  - Bind the resulting `{user, client, server}` context to the MCP session at connect time.

- **Authorization (scopes/claims)**
  - Map gateway scopes to MCP capabilities (e.g., list tools vs invoke tools).
  - Enforce least privilege per endpoint / per MCP method.

- **Session boundaries**
  - Treat any MCP session identifier as untrusted state (not authorization).
  - Ensure auth changes do not “inherit” prior session state incorrectly.

### Acceptance criteria

- Unauthenticated access returns a discovery-friendly `401` challenge.
- A valid gateway token allows MCP requests; invalid/expired/wrong-audience tokens are rejected.
- Scope checks are enforced for at least:
  - listing tools
  - invoking tools

### Implementation notes / pitfalls

- **Do not build crypto by hand**: use mature libraries for validation.
- **Do not log**: Authorization headers, tokens, codes, secrets.
- **Clock skew**: allow small skew while validating `exp`/`nbf`.

---

## Phase 2 — OAuth brokering for upstream MCP servers (gateway → upstream, per server)

### Scope

When a user invokes functionality routed to an upstream MCP server that requires OAuth, the gateway must obtain and manage a **per-user grant** for that server and send **server-specific access tokens** on upstream calls.

### Key capabilities

- **Upstream server “connection” model**
  - Represent each upstream server as a distinct connection with:
    - server base URL / identifier
    - whether it requires OAuth
    - its PRM / AS metadata discovery details
    - requested scopes (upstream-specific)

- **PRM per upstream connection**
  - For “connect upstream server S”, publish a PRM URL that the client can use to discover how to authorize *for S via the gateway*.
  - On missing upstream grant, gateway returns `401` with `resource_metadata="<PRM for upstream S connection>"`.

- **Authorization Code + PKCE completion that results in gateway-held tokens**
  - The flow must result in the gateway obtaining (and storing) tokens it can use to call upstream server S.
  - Store refresh tokens encrypted; access tokens cached short-term.

- **Token refresh + caching**
  - Refresh upstream access tokens when expired.
  - Cache access tokens with conservative TTLs; handle revocation/invalid_grant.

- **Forwarding behavior**
  - For upstream calls, attach `Authorization: Bearer <token-for-S>`.
  - Do not forward the gateway token to upstream servers unless explicitly designed and safe.

- **User experience**
  - Provide a clear “authorization required” path that MCP clients can follow.
  - (Optional) Provide a UI page where users can see which upstream servers are connected and disconnect/revoke them.

### Acceptance criteria

- If upstream server S requires OAuth and user hasn’t authorized it, gateway returns a discovery-friendly `401` challenge pointing to the correct PRM for S.
- After completing authorization, the gateway can successfully call S on behalf of the user and the original operation succeeds.
- Tokens are isolated per `{user, upstream server, issuer/tenant}`.

### Implementation notes / pitfalls

- **Issuer/tenant mix-up**: store and validate issuer per upstream config; do not accept tokens from unexpected issuers.
- **Least privilege**: request the minimal upstream scopes needed.
- **Revocation/disconnect**: support deleting stored grants per upstream server and user.

---

## Phase 3 — Hardening and enterprise features

Pick from the following based on needs:

- **Audit logging**
  - Record “who did what” at the gateway level (without logging tokens).

- **Policy engine integration**
  - Enforce enterprise policy (per user, per tool, per server) before contacting upstream servers.

- **Credential lifecycle**
  - Key rotation for token encryption.
  - Automated cleanup of stale grants.

- **Advanced OAuth features (only if required)**
  - DPoP / sender-constrained tokens
  - Token exchange / on-behalf-of (if the enterprise AS and upstream servers support it)
  - Fine-grained scope mapping and consent screens

---

## Open questions (to resolve as we implement)

- What is our canonical **gateway resource identifier** (RFC 8707 `resource`)?
- Do we want one gateway AS or support multiple issuers (enterprise)?
- For upstream authorization, do we terminate the OAuth callback at the gateway UI or a dedicated callback service?
- What is the minimal initial scope vocabulary for MCP operations in our product?
- What is our **user provisioning** policy (JIT vs admin-created), and how do we bootstrap the first admin safely?
- What is our fallback when no external auth server is available (e.g., bundle a self-hosted OIDC provider such as Dex/Authelia, or run in a non-OAuth “client-token-only” mode)?


