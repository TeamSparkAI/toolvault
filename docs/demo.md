# Demo

## Discovery and Management

### Prep
- ./reset.sh
  - Delete toolvault.sqlite
  - Restore Claude global (time)
  - Restore Cursor mcp-link (memory, filesystem, fetch)
  - Restore VS Code teamspark-ai-api (git)
  - Restore Claude Code toolshed (fetch, sqlite added)
  - Restore Cursor toolshed (sqlite added)

### Presentation

### Demo

Discover and import all global clients and tool-using project clients
- Run claude (toolshed)
  - Review servers /mcp, exit
- Import - exclude teamspark-ai-workbench (VSCode) project
- Review clients, drill into mcp-link, show servers
- Review servers, drill into fetch, show clients
- Review Claude Code (global) - time server
- Run claude (toolshed)
  - Review servers /mcp, select time server, list tools
  - "what time is it in PDT"
- Back to time server, look at messages to see messages from Claude Code

Discover and import teamspark-ai-workbench without autoconvert
- Show unmanaged server, test (in place)
- Compliance
- Convert
- Compliance
- Show VSCode with new config, using managed server
- Run in container
- Compliance

Server Catalog and install
- AgentQL (demo secret env, cancel)
- Auth0 (install, fail, logs)
- Sqlite (~/Library/Application Support/ToolVault/toolvault.sqlite)
  - Select run in container, Save
  - Ping, tools (list tables, do a query), logs

Deploy new server to clients
- Import toolshed Cursor client (not using tools)
- Add sqlite to toolshed Cursor and Claude Code clients
- Demo sqlite in Cursor? 
  - Cursor Settings
  - Test prompt

===================================================================================================


## Polices and Alerts

### Prep

[Load fresh data, set one client to run in container, add weather.com SSE disabled]

### Demo

Quick pass through menu for orientation

Dashboard

Servers

Clients
- Configure tspark client with everything, test echo with Amex 372119825827619

Policies
- Pop into the 4 criticials as example
  -Go through details on first one
- Filters: Explain regex, keywords, validators
  - Credit card numbers (luhn validator)
  - PII (SSN keywords)

Messages
- Toggle days to 30
- Click through all filter values
- Filter on method tools/call
- Click into a tool call message
- Click into client notification
- Click into server notification

Alerts
- Toggle days to 30
- Click through all filter values
- Filter on critical / clear
- Find tspark Amex alert - drill in
- Find PII - US Phone Number - drill in
- Find Internal Network Details - drill in

API
- The Web app is implemented through these APIs
  - The API offers even more functionality - more analytics
- Demo
  - /servers