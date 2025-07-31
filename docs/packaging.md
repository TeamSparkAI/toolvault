# Packaging System

## Overview

This document describes our current packaging and build system for the ToolVault project. We use a workspace-based monorepo structure with automated build orchestration.

## Current State

### Project Structure
```
toolvault/
├── package.json (workspace root)
├── dist/ (build output directory)
│   ├── docker/ (Docker files and scripts)
│   ├── server/ (bundled server application)
│   ├── public/ (static assets)
│   └── migrations/ (database migrations)
├── projects/
│   ├── server/ (Next.js application)
│   ├── bridge/ (MCP bridge library)
│   ├── proxy/ (proxy service)
│   ├── docker/ (Docker containers and scripts)
│   └── shared/ (shared utilities)
├── docs/ (documentation)
└── scripts/
    └── build.js (build orchestration)
```

### Current Build Processes
- **Server**: Next.js application with production build and static export
- **Bridge**: TypeScript library for MCP bridge functionality
- **Docker**: Custom runner containers with proxy detection
- **Proxy**: Standalone proxy service for package caching
- **Root**: Workspace orchestration with unified distribution

## Current Implementation

### 1. Root Package Configuration

The root `package.json` is configured as a workspace-based monorepo:

```json
{
  "name": "toolvault",
  "version": "0.1.17",
  "description": "Tool Vault: An Integrated platform for AI agent tool management and security",
  "workspaces": [
    "projects/*"
  ],
  "scripts": {
    "build": "node scripts/build.js",
    "build:server": "npm run build --workspace=projects/server",
    "dev": "npm run dev --workspace=projects/server"
  }
}
```

### 2. Build Process

#### Build Orchestration (`scripts/build.js`)
1. **Clean dist directory** - Remove existing build artifacts
2. **Build server project** - Next.js production build
3. **Copy Docker files** - Copy Docker containers and scripts to `dist/docker/`
4. **Copy static assets** - Public files, migrations, data files
5. **Verify build** - Check all components exist

#### Server Build Process
- **Next.js build**: `npm run build` creates optimized production build
- **Static export**: Server runs as a Next.js application with API routes
- **Database**: SQLite database with migrations
- **Docker integration**: Custom runner containers for secure package execution

### 3. Application Structure

#### Web Application
- **Next.js server**: Runs on configured port (default 3000)
- **API routes**: RESTful API for MCP server management
- **Web UI**: React-based interface for server administration
- **Database**: SQLite with automatic migrations

#### Docker Integration
- **Runner containers**: Custom containers for `npx` and `uvx` execution
- **Proxy containers**: Containerized package caching proxies
- **Security**: Isolated execution with proxy detection and fallback

#### Usage
```bash
# Development
npm run dev

# Production build
npm run build

# Start server
npm start
```

### 4. Key Technical Details

#### Server Architecture
- **Next.js application**: Full-stack web application with API routes
- **MCP bridge integration**: Uses local bridge library for MCP protocol
- **Database**: SQLite with automatic migrations and schema management
- **Docker integration**: Custom containers for secure package execution

#### Docker Architecture
- **Runner containers**: `teamspark/npx-runner` and `teamspark/uvx-runner`
- **Proxy containers**: Verdaccio (npm) and proxpi (Python) for package caching
- **Security**: Isolated execution with no direct cache access
- **Fallback**: Automatic fallback to public registries if proxies unavailable

#### Bridge Integration
- **Local workspace**: MCP bridge library in `projects/bridge`
- **TypeScript**: Full TypeScript support with proper module resolution
- **Protocol support**: Complete MCP protocol implementation

### 5. Distribution Structure

#### Final Build Contents
```
dist/
├── server/ (Next.js build)
├── docker/ (Docker containers and scripts)
├── public/ (static assets)
├── migrations/ (database migrations)
└── data/ (data files)
```

#### Runtime Dependencies
- **Server**: Requires Node.js 20+ and Docker
- **Database**: SQLite database with migrations
- **Docker**: Required for containerized execution

### 6. Build Dependencies

#### Server Dependencies
- **Next.js**: For web application framework
- **React**: For UI components
- **TypeScript**: For type safety and compilation
- **SQLite**: For database storage

#### Docker Dependencies
- **Docker**: For containerized execution
- **Custom containers**: Runner and proxy containers

#### Bridge Dependencies
- **TypeScript**: For MCP protocol implementation
- **Node.js**: For runtime environment

### 7. Deployment Strategy

#### Application Type
- **Web application**: Next.js server with web UI
- **Containerized execution**: Docker-based package execution
- **Database**: SQLite with automatic migrations

#### Deployment Options
- **Local development**: `npm run dev`
- **Production build**: `npm run build`
- **Docker deployment**: Containerized application
- **Cloud deployment**: Deployable to various cloud platforms

#### Runtime Requirements
- **Node.js 20+**: For server execution
- **Docker**: For containerized package execution
- **SQLite**: For data storage

### 8. Build and Deployment Workflow

#### Build Process
```bash
npm run build
```
- Builds Next.js application
- Copies Docker files and scripts
- Copies static assets and migrations
- Verifies all components exist

#### Development Workflow
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start           # Start production server
```

#### Docker Integration
- **Runner containers**: Built automatically on server startup
- **Proxy containers**: Started automatically on server startup
- **Security**: Isolated execution with proxy detection

#### Deployment Checklist
- [ ] All tests pass
- [ ] Build completes successfully
- [ ] Docker containers build correctly
- [ ] Database migrations run successfully
- [ ] Documentation is updated
- [ ] Environment variables are configured

## Implementation Stages

### ✅ Stage 1: Basic Package Structure
- [x] Create root `package.json` with workspace configuration
- [x] Configure workspaces for `projects/*`
- [x] Add build scripts
- [x] Test basic structure

### ✅ Stage 2: Server Implementation
- [x] Next.js application with API routes
- [x] Database integration with SQLite
- [x] MCP bridge integration
- [x] Web UI for server administration

### ✅ Stage 3: Docker Integration
- [x] Custom runner containers for secure execution
- [x] Proxy containers for package caching
- [x] Security isolation and fallback mechanisms
- [x] Cross-platform compatibility

### ✅ Stage 4: Build Orchestration
- [x] Automated build process
- [x] Docker file copying and verification
- [x] Static asset management
- [x] Complete deployment workflow

### ✅ Stage 5: Production Deployment
- [x] Production build optimization
- [x] Database migration system
- [x] Environment configuration
- [x] Security hardening

## Final Implementation

The implementation uses a modern Next.js-based approach with Docker integration:

1. **Server**: Next.js application with API routes and web UI
2. **Docker**: Custom runner containers for secure package execution
3. **Bridge**: Local workspace project for MCP protocol implementation

### Key Files:
- `package.json`: Root configuration with workspace setup
- `dist/server/`: Next.js production build
- `dist/docker/`: Docker containers and scripts
- `scripts/build.js`: Build orchestration script

### Application:
- **Web UI**: React-based interface for server administration
- **API Routes**: RESTful API for MCP server management
- **Docker Integration**: Secure containerized package execution

The solution provides secure, isolated package execution with modern web interface and comprehensive Docker integration.

### 9. Future Enhancements

#### Potential Improvements
- Enhanced Docker container management
- Advanced proxy caching strategies
- Performance monitoring and metrics
- Multi-tenant support
- Advanced security features
- Cloud deployment automation

#### Documentation
- Comprehensive API documentation
- Docker deployment guides
- Security best practices
- Performance optimization guides
- Troubleshooting documentation

## Implementation Notes

### Build Dependencies
- `Next.js` for web application framework
- `TypeScript` for type safety
- `Docker` for containerized execution
- Build orchestration script for coordination

### Testing Strategy
- Unit tests for individual projects
- Integration tests for Docker containers
- Cross-platform testing
- User acceptance testing

### Release Process
1. Update versions in all projects
2. Run full build and test suite
3. Deploy to target environment
4. Verify Docker containers work correctly
5. Update documentation

## References

- [npm workspaces documentation](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [Next.js documentation](https://nextjs.org/docs)
- [Docker documentation](https://docs.docker.com/)
- [TypeScript documentation](https://www.typescriptlang.org/docs/)