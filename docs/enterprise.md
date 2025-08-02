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
- The hub would need to add workstation also (intance of ToolVault)
- ToolVault workstation models would need to evolve
  - Data (like servers and policies) will need source and permissions (ex: this policy came from upstream, and I can't edit or disable it)

We would presumably use a "real" SQL database for the hub (code uses the same model abstracton, and we have another implementaton in parallel to sqlite)

Phasing
- A first phase that just had compliance reporting might be an easy quick win
  - Allows you see see all workstations, see what MCP servers they're using and their security state