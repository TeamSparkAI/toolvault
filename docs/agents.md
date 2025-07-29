# Client Discovery and Import

## Discover

If we don't find mcpServers at top level (or under global key), should we go looking for it?

## Paths

Support paths for different OS (global config path, default search path)

Exclude directories for different OS

Expand ~ to os.homedir(), maybe also $HOME
- return filePath.replace(/^~/, os.homedir());

# Supported Agents (clients)

## TeamSpark Workbench

Add support?

## Cursor

https://docs.cursor.com/context/model-context-protocol (standard mcpServer structure)

Global: ~/.cursor/mcp.json
Project: .cursor/mcp.json

Issue: The .cursor directory only exists if created to contain project rules or tools
- Many projects may not have this and may not be identifiable/discoverable unless we find another way

## Claude Code

https://docs.anthropic.com/en/docs/claude-code/settings
https://docs.anthropic.com/en/docs/claude-code/mcp

  - Local: ~/.claude.json under "projects" / pathToProject / mcpServers (undocumented)
  - Project: .mcp.json in project root (documented)
  - User:  ~/.claude.json under mcpServers (undocumented)

## CoPilot (VS Code)

There is an open issue that VS Code might use the same mcp config for different agents (other than Copilot)

First, we determine if Copilot is installed in VS Code by looking for the CoPilot extension
If it is, then we include VS Code projects as possible CoPilot tool users
If an individual project has a .vscode/mcp.json, then we know it is a tool user
Otherwise it is a potential tool user (.vscode, but no mcp.json)

https://docs.github.com/en/copilot/customizing-copilot/using-model-context-protocol/extending-copilot-chat-with-mcp?tool=vscode

Default setting: defaultSettings.json - generated from code, contains:
- Contain many github.copilot keys, including:
    "github.copilot.enable": {
      "*": true,
      "plaintext": false,
      "markdown": false,
      "scminput": false
    }

Global/User settings
- Where
  - Windows: %APPDATA%\Code\User\settings.json
  - macOS: $HOME/Library/Application Support/Code/User/settings.json
  - Linux: $HOME/.config/Code/User/settings.json
- ToolHive used an mcp key at the top level, with servers below (no inputs), and a stray trailing comma (ouch)

Repository (if tools in use):
- Where: .vscode/mcp.json
  - It uses "servers" and not "mcpServers", and it has "inputs" section (and param replacement with inputs in servers)

Extensions
- Where
  - macOs/Linux: ~/.vscode/extensions  (/Users/bob/.vscode/extensions)
  - Windows: %USERPROFILE%\.vscode\extensions
- Dir: github-copilot-[version]
- there is also an extensions.json file there

## RooCode

https://github.com/RooCodeInc/Roo-Code
- Open source VS Code extension

https://docs.roocode.com/advanced-usage/available-tools/use-mcp-tool#server-configuration

Global Configuration
- Managed through the Roo Code extension settings in VS Code. These apply across all projects unless overridden
Project-level Configuration
- Defined in a .roo/mcp.json file within your project's root directory

## Windsurf

Windsurf is it's own VS Code fork AND a boatload if plugins for every IDE

https://docs.windsurf.com/windsurf/cascade/mcp

mcp_config.json

## Generic

Anything with an mcp.json that isn't one of the supported/recognized clients

## TeamSpark Workbench
 
Options:
- Add client support, sync to tspark.json
- Change file from tspark.json to mcp.json, will be supported as Generic