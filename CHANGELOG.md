# ToolVault Release Notes

## [v1.0.2] - 08-20-2025

### Fixed

MCP servers converted in client servers tab didn't work correctly until restart.

Cleanup log messages, added package version to startup log event.


## [v1.0.1] - 08-09-2025

### Added

Support for managing stdio servers that care what directory they run in
- Support cwd in stdio servers throughout product
- Initialize cwd to project directory on import (except for npx/uvx)

Support for home directory and env var expansion for stdio servers (in args, env var values, and cwd)
- Use `~`, `$VAR`, or `${VAR}`

Recovery and removal commands, including `--backups` and `--revert` for restoring IDE/Agent configurations
and `--clean` for removing all ToolVault data.  See [README.md](README.md) for details.

### Fixed

Some stdio servers emit noise to stdout before starting the MCP protocol (installation messages, output
of any pre-flight shell commands, errant console messages, etc).  We used to treat these as MCP protocol
errors.  We now just collect them and append them to the server log.  Once the first MCP message is emitted,
any subsequent noise will still generate an MCP protocol error.

## [v1.0.0] - 08-04-2025

Initial Release