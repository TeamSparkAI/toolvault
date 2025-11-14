# ToolVault Enterprise (ToolVault Hub)

Concepts
- Admin (role for an enterprise administator)
- Member (a person who is a member of the enterprise)
- Workstation (a computer, under the control of a member)
- Hub (enterprise version of ToolVaul to coordinate workstation ToolVault deployments)

Could be implemented as enterprise software or SaaS (or support both)

The hub will:
- Provide administraiton of members and workstations
- Provide central MCP servers that can be discovered and used by members
  - Admin can assign priviledges to use the server to a set of members
  - Delegated admin and config (Admin manages server config, member just points to it)
  - We could have delegated servers where the user is allowed to set some config elements
    - This would become a locally managed server, but one "approved" by admin with some admin configuration control
- Central message tracking, message processing (filtering), and alert management
- Consolidated compliance scanning (to understand the compliance status of all workstations)
  - Admin determines scanning requirement, config, and frequency
  - Workstation implements scan and reports to hub

Workstations can presumbaly have a combination of unmanaged, managed, and delegated MCP servers
- We would use compliance to report/understand
- We could have policies to prevent local managed servers, but for unmanaged, it's really just compliance reporting
  - I don't think we want to be deleting unmanaged tools from agents on compliance scan (but I guess we could)

Do we push policies from the hub to the workstatation for the workstation to apply
- The workstation can also have its own policies (if allowed, and which we'd want visibility of at the hub)
- We could use store/forward of message/alert data to hub instead of making the upstream calls in real-time
- Better performance and resilience (if hub connection is down or slow, or hub perf is slow, it would impact agent performance)

Or we could just say all policies are applied at hub, all messages are routed upstream and agents wait for reply

Data/Models
- ToolVault currently has the concept of a "User" in its models, but it's not really used anywhere.
- The hub would need to add workstation also (instance of ToolVault)
- ToolVault workstation models would need to evolve
  - Data (like servers and policies) will need source and permissions (ex: this policy came from upstream, and I can't edit or disable it)

We would presumably use a "real" SQL database for the hub (code uses the same model abstracton, and we have another implementaton in parallel to sqlite)

Phasing
- A first phase that just had compliance reporting might be an easy quick win
  - Allows you see see all workstations, see what MCP servers they're using and their security state
  - Modify to perform scan, report managed and unmanaged clients also (change how scan filtering works at service level)

## Architecture

Client will register itself with the server
- Will need server endpoint (arg or env)
- Authenticate as user
- Register workstation details (user-provided name, IP address, OS, ???)
- Receive long-lived access token

Client-to-server communication will be via REST API calls
Server-to-client communication will be:
- Server writes job to database
- Client polls for jobs via REST to server endpoint
  - This also serves as our client lastSeen/liveness indicator
- Client completes job and posts results via REST to server endpoint
  - Update any server-side listener/waiter when processing response
- Server polls db for job completion (if needed)

Later version could eliminate client polling and replace it with websocket or message queue
- Same mechanism would be used to report completion to eliminate server polling

For deeper introspection (or configuration management) on the client by the server
- Server can post any client API request to the "job" queue, client proxies (effectively) by calling local API, posting results via REST to server
- This gives us a lot of flexibility in interacting with the client during design/development (we could trim or remove later)

## Structure

Hub will be a separate "project" in toolvault monorepo
We will extract shared ux components and services into "shared" project as needed
- Layout, Dialog, common (button, badges, etc), alerts, etc (to start)
We will extract API logic into shared message handlers as needed
- These may take model factory as a param so the server and hub could use different model implementations (sqlite/postgres)
- This implies model abstraction is "shared"

## Upstream message processing

We want the hub message processor to see the messages first in both directions
- We don't want the client to be able to redact information such that the server can't see it
- If we have the hub applying enterprise policies, will individual devs still even want local policies?
  - If no, and we only apply policies at the server, this might be a lot cleaner
  - The client still needs to see the alerts and be able to apply them (but it can get them from the server)
  - Still ugly if the client has it's own servers and the hub wants to apply policies to their usage (arguing for the policy-application-point approach below)

Local (client) managed server
- Client bridge message processor sends message to upstream for processing first, then does its own message processing (both directions)

Remote (hub) managed server
- SSE to SSE bridge
  - Bridge message processor calls client message processor (this isn't ideal, because client can modify payload before server sees it)
  - Hub will have it's own message processor on it's SSE->whatever bridge
  - For client->server message, hub bridge processes message, calls back to client to process for processing, forwards resulting message to server
  - For server->client message, hub bridge processes message, could call back to client, or just let it flow back where client bridge picks it up and processes it
    - This might depend on whether the server wants to see/collect client modifications

If both the client and hub apply policies and modify messages, in order for either one to display redactions properly, will need alerts from both
- We currenrly maintain the original message and a set of alerts that can be applied to produce the final message
- If server modifies message, that seems like original message to the client (that seems problematic)

What if we always have the client do upstream message processing in both directions (hub does no processing in its bridge)
- Client always sends to server first, then applies own processing
  - Client now has original message, it's alerts, and hub modified message with (potentially with hub alerts)
  - But now hub doesn't have final message (client mods and client alerts) - maybe this is OK if hub only cares about applicaiton of hub policies?

There is an alternate model (used in some security policy engines) where the client is the "policy application point"
- In this model, the server pushes its policies to the client, and the client applies the policies and forwards the results back to the server
- This gives us a clearly defined single point of policy application, and allows for client and server policies
  - We'd need to send an alerts to the server, but not clear how this works with client and server alerts
    - Since the server won't have the client policies that generated the client alerts
- In some applications this allows the client to act in a disconnected state if needed (higher perf and not dependent on live server connection)
  - In our case since presumably much of this traffic will end up going through the server gateway to be routed, we don't really gain much (at least for hub-hosted servers)