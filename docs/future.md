# ToolVault Futures

Remap tools
- Meta tools combines tools from multiple servers (all, selected tools)
- Remove tools from server (suppress tools)

Desktop/CLI client
- Same functionality as gateway web app, using gateway REST APIs
- Any other functionality that would only make sense in the desktop app?

Enterprise version
- Centrally curated list of allowed tools
- Auditing of tool usage from all clients (via proxy)
- Ability for client gateway to proxy to upstream gateway (tool aggregation, tool proxying)

Other
- Auth (proxy)
- Risk Assessment
- Cost Tracking/Management
- OpenTelemetry support

Is there the idea that you might want to configure and test a server before adding it to the gateway (or edit a tool without impacting the gatewayed tool until you're done)?
- Right now tool testing is done *through* the bridge - if we didn't do that, we'd need another way to launch the client the same way mcp-link does
- And then we'd need some kind of deploy/deployed state to differentiate hosted servers with non-hosted (or not-yet-hosted) servers
- This seems like something to think about later 

Ideas:
- Quickstart (docs/video?)
- Chat agent to test tool usage via chat

Charting on Alerts and Messages tabs
- Specific to domain (for example, Server Messages, Client Alerts)
- Ex: Server Messages might want a pareto by toolName

UX: Click close to hide new alerts or chart controls (to make more space for alerts/messages, etc)

Support full text search (tool args and text results only?)
