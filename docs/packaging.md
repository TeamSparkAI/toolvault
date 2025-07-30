# Packaging Plan

## Overview

This document outlines the plan for creating a global npm package that installs both `tsh` (proxy) and `toolvault` (server) commands when installed globally.

## Current State

### Project Structure
```
toolvault/
├── package.json (workspace root with bin configuration)
├── dist/
│   ├── tsh (built proxy executable)
│   ├── toolvault (bundled server executable)
│   ├── standalone/ (Next.js build)
│   ├── public/ (static assets)
│   ├── migrations/ (database migrations)
│   └── data/ (data files)
├── projects/
│   ├── proxy/ (builds tsh command)
│   ├── server/ (Next.js application with esbuild bundling)
│   └── bridge/ (mcp-link project)
└── scripts/
    └── build.js (build orchestration)
```

### Current Build Processes
- **Proxy**: Uses `@vercel/ncc` to create a single executable `tsh`
- **Server**: Next.js application with esbuild bundling for single-file server executable
- **Bridge**: Local mcp-link project with TypeScript compilation
- **Root**: Workspace orchestration with unified distribution

## Current Implementation

### 1. Root Package Configuration

The root `package.json` is configured as a workspace-based monorepo:

```json
{
  "name": "toolvault",
  "version": "0.1.0",
  "description": "Tool Vault: An Integrated platform for AI agent tool management and security",
  "bin": {
    "tsh": "./dist/tsh",
    "toolvault": "./dist/toolvault"
  },
  "workspaces": [
    "projects/*"
  ],
  "scripts": {
    "build": "node scripts/build.js",
    "build:proxy": "npm run build --workspace=projects/proxy",
    "build:server": "npm run build --workspace=projects/server",
    "prepublishOnly": "npm run build"
  }
}
```

### 2. Build Process

#### Build Orchestration (`scripts/build.js`)
1. **Clean dist directory** - Remove existing build artifacts
2. **Build proxy project** - Creates `dist/tsh` executable
3. **Build server project** - Next.js build + esbuild bundling
4. **Copy server executable** - Creates `dist/toolvault` from bundled server
5. **Copy Next.js standalone** - Copies `.next/standalone` to `dist/standalone`
6. **Copy static assets** - Public files, migrations, data files
7. **Set permissions** - Make executables runnable
8. **Verify build** - Check all components exist

#### Server Build Process
- **Next.js build**: `npm run build` creates optimized production build
- **esbuild bundling**: `npm run build:server:bundle` creates single-file server
- **External dependencies**: Native modules and large dependencies kept external
- **Production mode**: Always runs in production mode for optimal performance

### 3. Command Structure

#### Global Commands
- `tsh` - The proxy command (from proxy project)
- `toolvault` - The server command (bundled server executable)

#### Usage After Installation
```bash
# Global installation
npm install -g toolvault

# Usage
tsh --help
toolvault --port 3000
```

### 4. Key Technical Details

#### Server Architecture
- **Unified process**: Single Node.js process manages both Next.js app and MCP bridge
- **esbuild bundling**: All custom code bundled into single `dist/server.js` file
- **External dependencies**: Next.js, React, native modules kept external
- **Production build**: Uses pre-compiled Next.js assets, no on-demand compilation

#### Proxy Architecture
- **ncc bundling**: All dependencies bundled into single executable
- **Standalone**: No external dependencies required
- **Cross-platform**: Works on Windows, macOS, Linux

#### Bridge Integration
- **Local workspace**: mcp-link project included as `projects/bridge`
- **SDK imports**: Fixed module resolution issues with `.js` extensions
- **Workspace linking**: Uses `file:../bridge` dependency reference

### 5. Distribution Structure

#### Final Package Contents
```
toolvault-1.0.0.tgz
├── package.json
├── README.md
├── LICENSE.md
├── dist/
│   ├── tsh (proxy executable)
│   ├── toolvault (server executable)
│   ├── standalone/ (Next.js build)
│   ├── public/ (static assets)
│   ├── migrations/ (database migrations)
│   └── data/ (data files)
└── docs/
```

#### Runtime Dependencies
- **Server**: Requires Node.js 20+ and external dependencies (Next.js, React, etc.)
- **Proxy**: Standalone executable, no external dependencies
- **Database**: SQLite database with migrations

### 6. Build Dependencies

#### Server Dependencies
- **esbuild**: For bundling TypeScript into single JavaScript file
- **Next.js**: For web application framework
- **React**: For UI components
- **mcp-link**: Local workspace project for MCP bridge functionality

#### Proxy Dependencies
- **@vercel/ncc**: For bundling into single executable
- **TypeScript**: For compilation

#### Removed Dependencies
- **tsx**: No longer needed (using bundled JavaScript)
- **tsc-alias**: No longer needed (esbuild handles path resolution)
- **@vercel/ncc**: Removed from server (using esbuild instead)
- **node-loader**: No longer needed (not using webpack)
- **nan**: Removed (not actually used)
- **node-fetch**: Removed (using built-in fetch)

### 7. Publishing Strategy

#### Package Name
- Publish as `toolvault` to npm registry
- Use semantic versioning for releases

#### Installation
```bash
npm install -g toolvault
```

#### Commands Available
- `tsh` - Proxy command
- `toolvault` - Server command

### 8. NPM Publishing Workflow

#### What Gets Published
Only the root package gets published to npm, containing:
- Built executables in `dist/` directory
- Root `package.json` with `bin` configuration
- README and documentation files
- License and other metadata files

**Sub-projects are NOT published individually** - they are only used for development and building.

#### Publishing Process

##### 1. Build Phase (Automatic)
```bash
npm run build
```
- Triggered by `prepublishOnly` script
- Builds both proxy and server projects
- Copies executables to `dist/`
- Ensures everything is ready for distribution

##### 2. Package Contents
```
toolvault-1.0.0.tgz
├── package.json
├── README.md
├── LICENSE.md
├── dist/
│   ├── tsh (executable)
│   ├── toolvault (executable)
│   ├── standalone/ (Next.js build)
│   ├── public/ (static assets)
│   ├── migrations/ (database migrations)
│   └── data/ (data files)
└── docs/ (optional)
```

##### 3. Publishing Commands
```bash
# Development workflow
npm run build          # Build both projects
npm test              # Run tests
npm publish           # Publish to npm

# Or with version bump
npm version patch     # Bump version
npm publish          # Publish new version
```

#### Version Management Strategy

##### Synchronized Versions
- All projects share the same version number
- Root package version drives everything
- Update all `package.json` files together

```bash
# Update all versions
npm version patch --workspaces
npm publish
```

#### Publishing Checklist
- [ ] All tests pass
- [ ] Build completes successfully
- [ ] Executables work on target platforms
- [ ] Version numbers are consistent
- [ ] Documentation is updated
- [ ] Changelog is updated
- [ ] npm login is complete
- [ ] Package name is available

#### Pre-publish Validation
```bash
# Test the package locally
npm pack              # Create tarball without publishing
npm install -g ./toolvault-1.0.0.tgz  # Test global install
tsh --help           # Test proxy command
toolvault --help     # Test server command
npm uninstall -g toolvault  # Clean up
```

#### Post-publish Verification
```bash
npm install -g toolvault@latest
tsh --version
toolvault --version
```

## Implementation Stages

### ✅ Stage 1: Basic Package Structure
- [x] Create root `package.json` with `bin` field
- [x] Configure workspaces for `projects/*`
- [x] Add build scripts
- [x] Test basic structure

### ✅ Stage 2: Proxy Implementation
- [x] Add `@vercel/ncc` to proxy dependencies
- [x] Configure proxy build script
- [x] Test bundled proxy executable
- [x] Verify `tsh --help` works

### ✅ Stage 3: Server Implementation
- [x] Migrate from TypeScript compilation to esbuild bundling
- [x] Fix module resolution issues with mcp-link
- [x] Integrate local bridge project
- [x] Configure production mode
- [x] Test bundled server executable
- [x] Verify `toolvault --help` works

### ✅ Stage 4: Build Orchestration
- [x] Update build script for esbuild-based approach
- [x] Simplify file copying logic
- [x] Update verification process
- [x] Test complete build process

### ✅ Stage 5: Global Installation Testing
- [x] Test `npm link` functionality
- [x] Verify both commands work globally
- [x] Test from different directories
- [x] Final validation

## Final Implementation

The implementation uses a modern esbuild-based approach:

1. **Proxy (`tsh`)**: Bundled with `@vercel/ncc` into a single executable
2. **Server (`toolvault`)**: Bundled with esbuild into a single executable with external dependencies
3. **Bridge**: Local workspace project with fixed module resolution

### Key Files:
- `package.json`: Root configuration with `bin` field
- `dist/tsh`: Bundled proxy executable
- `dist/toolvault`: Bundled server executable
- `scripts/build.js`: Build orchestration script

### Commands:
- `tsh --help`: Works globally via bundled executable
- `toolvault --help`: Works globally via bundled executable

The solution is self-contained and provides optimal performance with pre-compiled assets.

### 9. Future Enhancements

#### Potential Improvements
- Add command-line help and documentation
- Implement auto-update functionality
- Add configuration management
- Support for different installation modes (global vs local)
- Docker containerization
- Performance monitoring and metrics

#### Documentation
- Update README with installation instructions
- Add command-line help for both tools
- Create user guides for each command
- API documentation for server endpoints

## Implementation Notes

### Build Dependencies
- `esbuild` for server bundling
- `@vercel/ncc` for proxy bundling
- Build orchestration script for coordination

### Testing Strategy
- Unit tests for individual projects
- Integration tests for global installation
- Cross-platform testing
- User acceptance testing

### Release Process
1. Update versions in all projects
2. Run full build and test suite
3. Publish to npm registry
4. Verify global installation works
5. Update documentation

## References

- [npm workspaces documentation](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [npm bin field documentation](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#bin)
- [esbuild documentation](https://esbuild.github.io/)
- [@vercel/ncc documentation](https://github.com/vercel/ncc)