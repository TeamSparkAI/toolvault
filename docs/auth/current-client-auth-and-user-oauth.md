## Current client authentication vs user OAuth (and how they fit together)

This document captures:

- what we do **today** (authenticate a *client/app*, not a *user*),
- why that gives us basic protection and enables **client→server mapping** as a packaging model, and
- how this relates to (and can coexist with) a future **multi-user OAuth** model at the gateway.

---

## Executive summary

- **Today**: access to the MCP bridge/proxy path is protected by a **ToolVault-issued proxy JWT**. That JWT is minted after validating a **server token** plus an optional **client token**. This authenticates the **client/app**, not the human **user**.
- **Why we do this**: we map **clients → servers** for access control and “packaging” (e.g., per project/workspace). We also inject client credentials into client configurations we scan/import, so the client can later authenticate to the gateway and receive a proxy config/token.
- **What’s missing**: in a multi-user scenario we need a verified **user identity** (per-user authorization, audit, and per-user upstream OAuth grants). Today the “user” value is caller-provided and not verified.
- **Where we’re going**: if OAuth is configured, the gateway should authenticate the **user** via OAuth, while **preserving** the existing “client token identifies the app/project and maps to a set of servers” concept.
- **Config shape matters**: we configure **one MCP client server entry per upstream MCP server** (no aggregation). In OAuth mode, many MCP clients will treat each entry as a separate “server” and may initiate auth per entry (even if tokens can sometimes be reused/cached).

---

## Making this truly multi-user (users, roles, and ownership)

To move from “single-operator” to a truly multi-user system we need:

- a **users table** that represents real human users
- a way to **authenticate users** when they use the web console (today the console does not require auth)
- role-based authorization (**admin** vs **user**)
- ownership rules (clients are owned by exactly one user)

### User identity and correlation

If OAuth is enabled, user identity should come from the validated access token:

- `issuer` = JWT `iss`
- `subject` = JWT `sub`

We treat `(issuer, subject)` as the stable identity key and create/lookup an internal `user_id`.

### Roles

- **admin**: can manage users and see/manage all data.
- **user**: can only see/manage data they own (e.g., their clients, their client↔server mappings, their messages/actions, their upstream OAuth grants).

### Web console authentication

The web UI should require OAuth login when OAuth is configured, and all APIs invoked by the UI should enforce the same RBAC rules server-side.

---

## What we do today (as implemented)

### 1) Client presents server token + client token to get a short-lived proxy JWT

- Endpoint: `POST /api/v1/proxy`
- Inputs:
  - **server token** (required)
  - **client token** (optional, and can be required by settings)
  - a `user` string in the request body (currently not verified)
- Output:
  - a signed **proxy JWT** (expires ~1 hour)
  - an MCP “proxy config” pointing to the bridge URL with `Authorization: Bearer <proxy JWT>`

This is the core “authenticate the client/app” handshake.

### 1.1) How clients are configured today (stdio shim)

When we “host” managed servers for a client, we write stdio MCP server entries that run `tsh`. Each MCP server entry corresponds to a single upstream server; we do not aggregate multiple upstream servers into one logical MCP server entry.

### 2) The proxy JWT is locally signed and tied to a single server token

The proxy JWT is signed by the server with a secret generated per app instance (so restarting the app invalidates old tokens). The payload includes:

- `serverToken`, `serverName`, `serverId`
- `clientId` (ToolVault client id) or null
- `user` (string, caller-provided today)
- `sourceIp`

### 3) MCP over SSE/streamable is authorized using that proxy JWT

The bridge (SSE / streamable) checks:

- an `Authorization: Bearer ...` header is present
- the token verifies
- the token’s `serverToken` matches the URL path segment (the “server name” in the bridge is actually the server token)
- the `clientId` from the JWT is re-validated against current settings and client↔server mappings

This protects MCP traffic so the bridge isn’t “wide open”.

---

## Why this is useful (even before OAuth)

### 1) It provides basic protection for the proxy/bridge

The proxy endpoint and bridge require a bearer token that the client can only obtain if it has:

- the server token, and (optionally/depending on settings)
- the client token that we previously gave it (e.g., by embedding/injecting it into the client config during scan/import)

So “random internet traffic” can’t just connect; it must present credentials we issued.

### 2) It encodes the “clients package servers” model

We don’t just treat clients as “authn identities”; we also treat them as **groupings**:

- A “client” can represent a specific product integration, project, or workspace.
- We map **clients → servers** for:
  - access control (client is allowed to use server)
  - packaging (servers relevant to that client/project)

This remains valuable even after we introduce user OAuth.

---

## The key limitation: we authenticate the client/app, not the user

### 1) Current “user” is not an authenticated identity

Right now, the “user” field is supplied by the caller to `/api/v1/proxy`. That means:

- it’s not a verified identity
- it’s not safe for auditing (“who did what?”)
- it’s not sufficient for per-user policy decisions

### 2) Multi-user OAuth changes the axis of identity

OAuth at the gateway is primarily about **who the person is** (resource owner), not just which app is calling.

Once OAuth is enabled we generally want:

- requests to be authorized **per user**
- upstream server authorizations (OAuth to upstream servers) to be stored **per user**

---

## How “client auth” and “user OAuth” should relate

The clean mental model is: **two orthogonal identities**.

- **User identity (OAuth)** answers: “Which human is calling the gateway?”
- **Client identity (ToolVault client token)** answers: “Which client/app/project context is this, and which servers does it map to?”

In a multi-user world we likely still want:

- OAuth **required** (or optional) for gateway access
- client token used to select/limit server sets and enforce client↔server mappings

### A practical rule of thumb

- If **OAuth is configured**: treat OAuth as the authoritative **user identity**.
- Keep client tokens for **packaging and access-control constraints**, not as the primary user identity.

---

## Data model implications (high level)

We assume **clients are owned by a single user**. That means we need an explicit user concept and an owner reference on each client record.

### Client ownership (single user)

Add fields like (pick one of these approaches):

- `clients.ownerUserId` (internal user id), where the internal user is derived from OAuth identity
  - OR `clients.ownerIssuer` + `clients.ownerSubject` (OAuth `iss` + `sub`)

This supports: “a client belongs to a user” and makes it easy to enforce that a user can only use their own clients.

### What’s important

- We need a stable, verified user identifier (likely derived from OAuth token claims like `iss` + `sub`).
- We should preserve the existing mapping **clients ↔ servers** because it’s not only auth—it’s product packaging.
-
- When OAuth is enabled, any request that supplies a `clientToken` should be authorized such that the **OAuth user matches the client owner** (otherwise a leaked client token could be used by a different user).
-
- When OAuth is enabled, we should stop trusting the request-body `user` field for identity; user identity should be derived from the OAuth token.

---

## How this dovetails with the proposed OAuth gateway design

If we enable OAuth at the gateway:

- The gateway becomes a **resource server** validating JWTs from an external Authorization Server (e.g., Auth0).
- “User id” should come from the OAuth access token (`sub`), not from request bodies.
- We can still issue an internal short-lived token for the bridge, but its payload should include:
  - verified `userId` (from OAuth)
  - `clientId` (ToolVault client context), if used
  - `serverId` / `serverToken` context

And we should expect to store upstream OAuth grants **per user** (and per upstream server), which is a separate store from client tokens.

### OAuth-to-gateway implies HTTP transport (SSE/streamable), not stdio

To have MCP clients perform MCP-spec OAuth directly against the gateway, the client must connect via an HTTP transport (**SSE** or **streamable HTTP**) so it can:

- receive a `401` + `WWW-Authenticate` challenge
- discover `resource_metadata` (PRM)
- complete Authorization Code + PKCE
- retry with `Authorization: Bearer <access_token>`

This likely means that for OAuth-to-gateway mode we will configure clients with **SSE/streamable server entries pointing directly at the gateway**, rather than routing through the stdio `tsh` shim.

### Passing client/server context in OAuth mode

If the gateway authenticates the user (OAuth) and enforces that the **user owns the client** and that the **client can access the server**, then `clientId` / `serverId` do not need to be treated as secrets. They can be treated as untrusted **selectors/payload** supplied via headers or query params in the SSE/streamable server config.

Security comes from:

- validating the bearer token, and
- server-side authorization checks against ownership and client↔server mappings.

---

## Open questions / decisions

- When OAuth is enabled, do we still require a client token for `/api/v1/proxy`, or is it optional?
- Do we want to treat “client token” as a long-lived secret (as today), or move toward OAuth-native client identity (`client_id`) long term?
- How do we handle “headless”/automation scenarios (no interactive user) if we later need them?
- How do we backfill ownership for existing clients (default owner, admin assignment flow, or import-time assignment)?
- What is our user provisioning strategy (JIT user creation on first login vs admin-created users), and how do we bootstrap the first admin?
- What is our fallback if there is no external auth server available (e.g., ship a self-hosted OIDC provider, or run in “client-token-only” mode)?


