# ToolVault Release Notes

## [v1.0.1] - 08-08-2023

### Added

Support for managing stdio servers that care what directory they run in
- Support cwd in stdio servers throughout product
- Initializate cwd to project directory on import (except for npx/uvx)

Support for home directory and env var expansion for stdio servers (in args, env var values, and cwd)
- Use `~`, `$VAR`, or `${VAR}`

### Fixed

Some stdio servers emit noise to stdout before starting the MCP protocol (installation messages, output
of any pre-flight shell commands, errant console messages, etc).  We used to treat these as MCP protocol
errors.  We now just collect them and append them to the server log.  Once the first MCP message is emitted,
any subsequent noise will still generate an MCP protocol error.

## [v1.0.0] - 08-04-2023

Initial Release