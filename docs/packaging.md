# Packaging Plan

## Overview

This document outlines the plan for creating a global npm package that installs both `tsh` (proxy) and `toolvault` (server) commands when installed globally.

## Current State

### Project Structure
```
toolvault/
├── package.json (basic configuration)
├── projects/
│   ├── proxy/ (builds tsh command)
│   ├── server/ (Next.js application)
│   └── shared/ (common utilities)
```

### Current Build Processes
- **Proxy**: Uses `@vercel/ncc` to create a single executable `tsh`
- **Server**: Next.js application with custom server entry point
- **Root**: Minimal configuration, no build orchestration

## Proposed Solution

### 1. Root Package Transformation

Transform the root `package.json` into a workspace-based monorepo:

#### Key Changes
- Configure npm workspaces for `projects/*`
- Add `bin` field to expose both commands globally
- Add build scripts that compile both projects
- Include all necessary dependencies

#### Target Structure
```
toolvault/
├── package.json (workspace root with bin configuration)
├── dist/
│   ├── tsh (built proxy executable)
│   └── toolvault (built server executable)
├── projects/
│   ├── proxy/ (existing)
│   ├── server/ (existing)
│   └── shared/ (existing)
└── scripts/
    └── build.js (build orchestration)
```

### 2. Package.json Configuration

#### Root package.json
```json
{
  "name": "toolvault",
  "version": "1.0.0",
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

### 3. Build Process

#### Build Orchestration
1. **Proxy Build**: Continue using `@vercel/ncc` to create single executable
2. **Server Build**: Create standalone executable wrapper for Next.js server
3. **Root Build**: Orchestrate both builds and copy executables to `dist/`

#### Build Script (`scripts/build.js`)
- Clean `dist/` directory
- Build proxy project
- Build server project
- Copy executables to root `dist/`
- Set proper permissions

### 4. Command Structure

#### Global Commands
- `tsh` - The proxy command (from proxy project)
- `toolvault` - The server command (from server project)

#### Usage After Installation
```bash
# Global installation
npm install -g toolvault

# Usage
tsh --help
toolvault --port 3000
```

### 5. Implementation Steps

#### Step 1: Configure Root Package
- [ ] Set up npm workspaces in root `package.json`
- [ ] Add build scripts and dependencies
- [ ] Configure `bin` field for global installation
- [ ] Create build orchestration script

#### Step 2: Modify Server Project
- [ ] Create CLI wrapper for the server
- [ ] Ensure standalone executable build
- [ ] Handle port configuration and CLI arguments
- [ ] Update build process

#### Step 3: Update Proxy Project
- [ ] Verify build process creates correct executable
- [ ] Ensure proper shebang and permissions
- [ ] Test global installation

#### Step 4: Build Process
- [ ] Implement root build orchestration
- [ ] Copy built executables to root package
- [ ] Create final npm package structure

### 6. Key Considerations

#### Dependencies
- Ensure all dependencies are properly hoisted or included
- Handle peer dependencies correctly
- Manage version conflicts between projects

#### Platform Support
- Executables need to work across different platforms (Windows, macOS, Linux)
- Handle platform-specific build requirements
- Test installation on different operating systems

#### Versioning
- Coordinate versioning between root package and sub-projects
- Implement semantic versioning strategy
- Handle breaking changes across projects

#### Development Workflow
- Maintain ability to develop individual projects independently
- Support local development with `npm link`
- Preserve existing development scripts

#### Testing
- Test both commands work correctly when installed globally
- Verify cross-platform compatibility
- Test installation and uninstallation processes

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
│   └── toolvault (executable)
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

##### Option A: Synchronized Versions
- All projects share the same version number
- Root package version drives everything
- Update all `package.json` files together

```bash
# Update all versions
npm version patch --workspaces
npm publish
```

##### Option B: Independent Versions
- Sub-projects have their own versions
- Root package version is independent
- Track compatibility matrix

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
# Verify the published package
npm install -g toolvault@latest
tsh --version
toolvault --version
```

### 9. Future Enhancements

#### Potential Improvements
- Add command-line help and documentation
- Implement auto-update functionality
- Add configuration management
- Support for different installation modes (global vs local)

#### Documentation
- Update README with installation instructions
- Add command-line help for both tools
- Create user guides for each command

## Implementation Notes

### Build Dependencies
- `@vercel/ncc` for proxy bundling
- `pkg` or similar for server executable creation
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
- [@vercel/ncc documentation](https://github.com/vercel/ncc)