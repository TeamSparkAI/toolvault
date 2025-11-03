# New Registry Experience Integration Plan

## Overview
Add a new "MCP Registry" menu item alongside the existing "Server Registry" that uses the `@teamsparkai/mcp-registry-ux` package. This will follow the pattern of the main mcp-registry app.

## Goals
1. Keep existing "Server Registry" menu item functional (no changes)
2. Add new "MCP Registry" menu item with modern UX
3. Follow exact pattern from mcp-registry main app
4. Use mcp-registry-ux components directly
5. Integrate with ToolVault's existing catalog/installation system

## Current Menu Structure
```
Dashboard
Server Catalog (local server entries)
Server Registry (current custom implementation) ← Keep as-is
Manage >
  Servers
  Clients
  Policies
  Messages
```

## New Menu Structure
```
Dashboard
Server Catalog (local server entries)
Server Registry (current custom implementation) ← Keep as-is
MCP Registry (NEW - using mcp-registry-ux) ← Add this
Manage >
  Servers
  Clients
  Policies
  Messages
```

---

## Implementation Plan

### Phase 1: Setup & Configuration (30 minutes)

#### 1.1 Add CSS Import
**File**: `projects/server/app/globals.css`

Add at the TOP (before Tailwind directives):
```css
/* MCP Registry UX Styles */
@import '@teamsparkai/mcp-registry-ux/styles.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### 1.2 Create Route Utils
**File**: `projects/server/lib/utils/registryRouteUtils.ts` (NEW)

```typescript
/**
 * Utility functions for encoding/decoding server names in URL routes
 * Matches mcp-registry app pattern
 */

/**
 * Convert a server name for use in a URL path
 * Replaces '/' with '--'
 */
export function encodeServerNameForRoute(serverName: string): string {
  return serverName.replace(/\//g, '--');
}

/**
 * Convert a route parameter back to a server name
 * Replaces '--' with '/'
 */
export function decodeServerNameFromRoute(routeParam: string): string {
  return routeParam.replace(/--/g, '/');
}
```

#### 1.3 Update esbuild externals
**File**: `projects/server/package.json`

Add to `build:bundle` script externals:
```
--external:@teamsparkai/mcp-registry-client --external:@teamsparkai/mcp-registry-ux
```

---

### Phase 2: Navigation Adapter (30 minutes)

#### 2.1 Create Navigation Adapter
**File**: `projects/server/lib/adapters/mcpRegistryNavigationAdapter.tsx` (NEW)

```typescript
'use client';

import { NavigationAdapter, LinkProps } from '@teamsparkai/mcp-registry-ux';
import Link from 'next/link';
import { encodeServerNameForRoute } from '@/lib/utils/registryRouteUtils';

export const mcpRegistryNavigationAdapter: NavigationAdapter = {
  /**
   * Navigate to server detail page with specific version
   */
  goToServer: (serverName: string, version: string) => {
    // Return URL for Link component to use
    return `/mcp-registry/servers/${encodeServerNameForRoute(serverName)}/${encodeURIComponent(version)}`;
  },
  
  /**
   * Navigate to all versions of a server
   */
  goToServerVersions: (serverName: string) => {
    return `/mcp-registry/servers/${encodeServerNameForRoute(serverName)}`;
  },
  
  /**
   * Next.js Link component wrapper
   */
  Link: ({ href, children, className, onClick }: LinkProps) => {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
};
```

---

### Phase 3: Registry Client Setup (5 minutes)

We'll use the built-in `RegistryClient` from `@teamsparkai/mcp-registry-ux` pointing directly at the official MCP Registry.

No adapter needed - the library handles everything!

```typescript
import { RegistryClient } from '@teamsparkai/mcp-registry-ux';

const client = new RegistryClient({
  baseUrl: 'https://registry.modelcontextprotocol.io/v0'
});
```

**Benefits:**
- No custom adapter code to maintain
- Library handles pagination, URL encoding, errors, timeouts
- Direct access to official registry

---

### Phase 4: Main Registry List Page (1 hour)

#### 4.1 Create Main Registry List Page
**File**: `projects/server/app/mcp-registry/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServerResponse, ServerList, RegistryClient } from '@teamsparkai/mcp-registry-ux';
import { mcpRegistryNavigationAdapter } from '@/lib/adapters/mcpRegistryNavigationAdapter';
import { useLayout } from '@/app/contexts/LayoutContext';

export default function McpRegistryPage() {
  const router = useRouter();
  const { setHeaderTitle } = useLayout();
  const [servers, setServers] = useState<ServerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['Latest']);

  useEffect(() => {
    setHeaderTitle('MCP Registry');
    return () => setHeaderTitle(undefined);
  }, [setHeaderTitle]);

  useEffect(() => {
    loadServerRegistry();
  }, []);

  const loadServerRegistry = async () => {
    try {
      setLoading(true);
      const client = new RegistryClient({
        baseUrl: 'https://registry.modelcontextprotocol.io/v0'
      });
      // Fetch all servers (with high limit to get all)
      const response = await client.getServers({ limit: 10000 });
      setServers(response.servers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server registry');
    } finally {
      setLoading(false);
    }
  };

  // Filter servers based on search and filters
  const filteredServers = servers.filter(serverResponse => {
    const search = searchTerm.toLowerCase();
    const name = (serverResponse.server.name || '').toLowerCase();
    const description = (serverResponse.server.description || '').toLowerCase();

    const matchesSearch = !searchTerm || name.includes(search) || description.includes(search);
    
    // Filter logic for Latest/Hosted/Installable
    let matchesFilters = true;
    if (selectedFilters.length > 0) {
      matchesFilters = selectedFilters.every(filter => {
        if (filter === 'Latest') {
          return serverResponse._meta?.['io.modelcontextprotocol.registry/official']?.isLatest === true;
        } else if (filter === 'Hosted') {
          return serverResponse.server.remotes && serverResponse.server.remotes.length > 0;
        } else if (filter === 'Installable') {
          return serverResponse.server.packages && serverResponse.server.packages.length > 0;
        }
        return false;
      });
    }
    
    return matchesSearch && matchesFilters;
  }).sort((a, b) => (a.server.name || '').localeCompare(b.server.name || ''));

  const handleFilterToggle = (filter: string) => {
    setSelectedFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading MCP Registry...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Registry</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ServerList
      servers={servers}
      filteredServers={filteredServers}
      searchTerm={searchTerm}
      selectedFilters={selectedFilters}
      onSearchChange={setSearchTerm}
      onFilterToggle={handleFilterToggle}
      onClearFilters={() => setSelectedFilters([])}
      onServerClick={() => {}} // Navigation handled by Link in adapter
      navigationAdapter={mcpRegistryNavigationAdapter}
    />
  );
}
```

---

### Phase 5: Server Versions List Page (1 hour)

#### 5.1 Create Server Versions List Page
**File**: `projects/server/app/mcp-registry/servers/[serverName]/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ServerResponse, RegistryClient, getBestIcon } from '@teamsparkai/mcp-registry-ux';
import { encodeServerNameForRoute, decodeServerNameFromRoute } from '@/lib/utils/registryRouteUtils';
import { useLayout } from '@/app/contexts/LayoutContext';

export default function ServerVersionsPage() {
  const params = useParams();
  const router = useRouter();
  const { setHeaderTitle } = useLayout();
  const [versions, setVersions] = useState<ServerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
  }, [params.serverName]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const serverName = decodeServerNameFromRoute(params.serverName as string);
      
      const client = new RegistryClient({
        baseUrl: 'https://registry.modelcontextprotocol.io/v0'
      });
      
      const response = await client.getServerVersions(serverName);
      setVersions(response.servers);
      setHeaderTitle(serverName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server versions');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToRegistry = () => {
    router.push('/mcp-registry');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading versions...</p>
        </div>
      </div>
    );
  }

  if (error || versions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Server Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The requested server could not be found.'}</p>
          <button
            onClick={handleBackToRegistry}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Registry
          </button>
        </div>
      </div>
    );
  }

  const serverName = versions[0]?.server.name || decodeServerNameFromRoute(params.serverName as string);
  const latestVersion = versions.find(v => v._meta?.['io.modelcontextprotocol.registry/official']?.isLatest);

  return (
    <div className="space-y-6">
      {/* Server Header */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img 
              src={getBestIcon(versions[0]?.server.icons, 'light') || "/mcp_black.png"} 
              alt={versions[0]?.server.title || serverName}
              className="w-10 h-10 object-contain"
              onError={(e) => {
                e.currentTarget.src = "/mcp_black.png";
              }}
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{serverName}</h1>
            {versions[0]?.server.title && (
              <p className="text-lg font-semibold text-gray-800 mt-1">{versions[0].server.title}</p>
            )}
            {versions[0]?.server.description && (
              <p className="text-gray-600 mt-1">{versions[0].server.description}</p>
            )}
            <div className="mt-2 text-sm text-gray-500">
              {versions.length} version{versions.length !== 1 ? 's' : ''} available
            </div>
          </div>
        </div>
      </div>

      {/* Versions List */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Versions</h2>
        <div className="space-y-3">
          {versions.map((serverResponse) => {
            const version = serverResponse.server.version;
            const isLatest = serverResponse._meta?.['io.modelcontextprotocol.registry/official']?.isLatest;
            const publishedAt = serverResponse._meta?.['io.modelcontextprotocol.registry/official']?.publishedAt;
            const status = serverResponse.server.status;
            const versionPath = `/mcp-registry/servers/${encodeServerNameForRoute(serverName)}/${encodeURIComponent(version)}`;

            return (
              <Link
                key={version}
                href={versionPath}
                className="block border rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-lg font-semibold text-gray-900 font-mono">{version}</div>
                    {isLatest && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Latest
                      </span>
                    )}
                    {status === 'deprecated' && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        Deprecated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    {publishedAt && (
                      <span>
                        Published {new Date(publishedAt).toLocaleDateString()}
                      </span>
                    )}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                {serverResponse.server.packages && serverResponse.server.packages.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    {serverResponse.server.packages.length} package{serverResponse.server.packages.length !== 1 ? 's' : ''}
                  </div>
                )}
                {serverResponse.server.remotes && serverResponse.server.remotes.length > 0 && (
                  <div className="mt-1 text-sm text-gray-600">
                    {serverResponse.server.remotes.length} remote{serverResponse.server.remotes.length !== 1 ? 's' : ''}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

---

### Phase 6: Server Detail Page (1.5 hours)

#### 6.1 Create Server Detail Page
**File**: `projects/server/app/mcp-registry/servers/[serverName]/[version]/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ServerWithMeta, 
  ServerDetail,
  ServerDetailView,
  RegistryClient,
  generateConfiguredServer,
  createTrimmedServer
} from '@teamsparkai/mcp-registry-ux';
import { mcpRegistryNavigationAdapter } from '@/lib/adapters/mcpRegistryNavigationAdapter';
import { decodeServerNameFromRoute } from '@/lib/utils/registryRouteUtils';
import { useLayout } from '@/app/contexts/LayoutContext';
import { useModal } from '@/app/contexts/ModalContext';

export default function McpRegistryServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { setHeaderTitle } = useLayout();
  const { setModalContent } = useModal();
  const [server, setServer] = useState<ServerWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configuringServer, setConfiguringServer] = useState<ServerDetail | null>(null);
  const [packageConfig, setPackageConfig] = useState<Record<string, any>>({});
  const [remoteConfig, setRemoteConfig] = useState<Record<string, any>>({});
  const [showRawModal, setShowRawModal] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadServer();
  }, [params.serverName, params.version]);

  const loadServer = async () => {
    try {
      setLoading(true);
      const serverName = decodeServerNameFromRoute(params.serverName as string);
      const version = params.version as string;
      
      const client = new RegistryClient({
        baseUrl: 'https://registry.modelcontextprotocol.io/v0'
      });
      
      const serverResponse = await client.getServerVersion(serverName, version);
      
      // Convert ServerResponse to ServerWithMeta
      const unwrappedServer: ServerWithMeta = {
        ...serverResponse.server,
        _meta: serverResponse._meta
      };
      
      setServer(unwrappedServer);
      setHeaderTitle(serverResponse.server.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load server');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigurePackage = (pkg: any, index: number) => {
    if (!server) return;
    const trimmed = createTrimmedServer(server, index, undefined);
    setConfiguringServer(trimmed);
    setPackageConfig({});
  };

  const handleConfigureRemote = (remote: any, index: number) => {
    if (!server) return;
    const trimmed = createTrimmedServer(server, undefined, index);
    setConfiguringServer(trimmed);
    setRemoteConfig({});
  };

  const handleConfigurationOk = (trimmedServer: ServerDetail, config: any) => {
    // TODO: Integration with ToolVault catalog
    // This is where we'll add the configured server to the local catalog
    console.log('Configuration ready to install:', { trimmedServer, config });
    
    // For now, show a modal with the configuration
    setModalContent(
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Server Configuration Ready</h2>
        <p className="text-gray-600">
          This server is now configured and ready to be added to your catalog.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Server:</h3>
          <p className="text-sm">{trimmedServer.name} v{trimmedServer.version}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">MCP Config:</h3>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(config.mcpServerConfig, null, 2)}
          </pre>
        </div>
        {/* TODO: Add "Install to Catalog" button that calls catalog API */}
      </div>
    );
  };

  const closeConfiguration = () => {
    setConfiguringServer(null);
    setPackageConfig({});
    setRemoteConfig({});
    setVisibleFields(new Set());
  };

  const toggleFieldVisibility = (fieldId: string) => {
    setVisibleFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  const handleBackToRegistry = () => {
    router.push('/mcp-registry');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading server details...</p>
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Server Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'The requested server could not be found.'}</p>
          <button
            onClick={handleBackToRegistry}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Registry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ServerDetailView
      server={server}
      configuringServer={configuringServer}
      packageConfig={packageConfig}
      remoteConfig={remoteConfig}
      visibleFields={visibleFields}
      showRawModal={showRawModal}
      configuredServer={generateConfiguredServer(configuringServer, packageConfig, remoteConfig)}
      onPackageConfigChange={setPackageConfig}
      onRemoteConfigChange={setRemoteConfig}
      onToggleFieldVisibility={toggleFieldVisibility}
      onCloseConfiguration={closeConfiguration}
      onShowRawModal={setShowRawModal}
      onConfigurePackage={handleConfigurePackage}
      onConfigureRemote={handleConfigureRemote}
      onConfigurationOk={handleConfigurationOk}
      okButtonLabel="Install to Catalog"
      navigationAdapter={mcpRegistryNavigationAdapter}
    />
  );
}
```

---

### Phase 7: Menu Integration (15 minutes)

#### 7.1 Update Menu
**File**: `projects/server/app/components/Layout.tsx`

Add new menu item after "Server Registry" (around line 184):

```typescript
    { 
      label: 'Server Registry', 
      path: '/registry',
      headerTitle: 'Server Registry',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    { 
      label: 'MCP Registry', 
      path: '/mcp-registry',
      headerTitle: 'MCP Registry',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
    },
```

---

### Phase 8: Future Integration with Catalog (Optional)

This phase connects the "Install to Catalog" functionality.

#### 8.1 Create Installation Service
**File**: `projects/server/lib/services/registryInstallService.ts` (NEW)

```typescript
import { ServerDetail } from '@teamsparkai/mcp-registry-ux';
import { logger } from '@/lib/logging/server';

/**
 * Service to install servers from MCP Registry to local catalog
 */
export class RegistryInstallService {
  /**
   * Install a configured server from registry to catalog
   */
  async installToCatalog(
    trimmedServer: ServerDetail,
    mcpConfig: any
  ): Promise<{ success: boolean; serverId?: string; error?: string }> {
    try {
      // TODO: Map registry server format to catalog format
      // This will need to:
      // 1. Create a catalog entry with the server metadata
      // 2. Store the MCP configuration
      // 3. Return the created server ID
      
      logger.info('[RegistryInstall] Installing server to catalog:', {
        name: trimmedServer.name,
        version: trimmedServer.version
      });
      
      // Placeholder implementation
      return {
        success: false,
        error: 'Not yet implemented'
      };
    } catch (error) {
      logger.error('[RegistryInstall] Failed to install server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

---

## File Structure Summary

```
projects/server/
├── app/
│   ├── mcp-registry/                          (NEW)
│   │   ├── page.tsx                           (NEW - main registry list)
│   │   └── servers/                           (NEW)
│   │       └── [serverName]/                  (NEW)
│   │           ├── page.tsx                   (NEW - versions list)
│   │           └── [version]/                 (NEW)
│   │               └── page.tsx               (NEW - server detail)
│   ├── registry/                              (KEEP - old implementation)
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── components/
│   │   └── Layout.tsx                         (MODIFY - add menu item)
│   └── globals.css                            (MODIFY - add CSS import)
├── lib/
│   ├── adapters/                              (NEW)
│   │   └── mcpRegistryNavigationAdapter.tsx   (NEW)
│   ├── utils/
│   │   └── registryRouteUtils.ts              (NEW)
│   └── services/
│       └── registryInstallService.ts          (NEW - optional)
└── package.json                                (MODIFY - add esbuild externals)
```

---

## Testing Checklist

### Functional Testing
- [ ] New "MCP Registry" menu item appears
- [ ] Click "MCP Registry" loads server list
- [ ] Server list displays with cards/grid
- [ ] Search filters servers correctly
- [ ] Filter buttons (Latest/Hosted/Installable) work
- [ ] Click server card navigates to versions list page
- [ ] Versions list page shows all versions of server
- [ ] Click version navigates to detail page
- [ ] Server detail page loads and displays information
- [ ] "Back to Registry" button works
- [ ] Configuration forms appear when clicking "Configure"
- [ ] Configuration forms validate input
- [ ] Can configure package arguments
- [ ] Can configure remote headers
- [ ] Field visibility toggles work (for secrets)
- [ ] "Install to Catalog" button shows modal
- [ ] URLs encode/decode server names correctly (test with `/` in name)
- [ ] Server icons display correctly
- [ ] Latest/Deprecated badges show on versions list

### Visual Testing
- [ ] Components match ToolVault theme
- [ ] Responsive design works (mobile/tablet/desktop)
- [ ] Dark mode works (if applicable)
- [ ] Icons display correctly
- [ ] Typography consistent with ToolVault
- [ ] Spacing/padding looks good

### Integration Testing
- [ ] Old "Server Registry" still works unchanged
- [ ] Both registry experiences coexist without conflicts
- [ ] API endpoint handles requests correctly
- [ ] Navigation between pages works
- [ ] Browser back/forward buttons work

---

## Timeline Estimate

- **Phase 1** (Setup): 30 minutes
- **Phase 2** (Navigation): 30 minutes
- **Phase 3** (Registry Client): 5 minutes
- **Phase 4** (Main List Page): 1 hour
- **Phase 5** (Versions List Page): 1 hour
- **Phase 6** (Detail Page): 1.5 hours
- **Phase 7** (Menu): 15 minutes
- **Phase 8** (Catalog Integration): 2+ hours (future)

**Total**: ~4.5 hours (excluding Phase 8)

---

## Benefits

1. **Modern UX**: Professional, tested components from mcp-registry-ux
2. **Consistency**: Matches official MCP Registry experience
3. **Maintainability**: Library handles complex UI logic
4. **Type Safety**: Full TypeScript support
5. **Feature Rich**: Configuration forms, validation, icons, etc.
6. **Side-by-Side Comparison**: Can compare old vs new experiences
7. **Easy Migration**: Once validated, can deprecate old registry

---

## Risks & Mitigation

### Risk: CSS Conflicts
- **Mitigation**: mcp-registry-ux uses scoped classes, minimal conflict risk
- **Test**: Verify both registries display correctly

### Risk: Type Mismatches
- **Mitigation**: RegistryClient returns proper types from library
- **Test**: Ensure all data displays correctly

### Risk: URL Encoding Issues
- **Mitigation**: Use same `--` encoding strategy as mcp-registry app
- **Test**: Test with servers that have `/` in name

### Risk: Performance
- **Mitigation**: Library handles pagination and caching efficiently
- **Test**: Measure page load times, may need client-side caching

---

## Success Criteria

- [ ] "MCP Registry" menu item functional
- [ ] Can browse and search servers
- [ ] Can view server details
- [ ] Can configure servers
- [ ] Configuration generates valid MCP config
- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] No console errors
- [ ] All URLs work correctly
- [ ] Old "Server Registry" still works

---

## Next Steps After Implementation

1. **User Testing**: Get feedback on new UX vs old
2. **Catalog Integration**: Implement Phase 7 to actually install servers
3. **Migration Decision**: Decide whether to deprecate old registry
4. **Documentation**: Update docs to reference new registry
5. **Analytics**: Track usage of both registries

