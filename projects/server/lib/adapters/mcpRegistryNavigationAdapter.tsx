import { NavigationAdapter, LinkProps } from '@teamsparkai/mcp-registry-ux';
import Link from 'next/link';
import { encodeServerNameForRoute } from '@/lib/utils/registryRouteUtils';

/**
 * Navigation adapter for integrating mcp-registry-ux with Next.js routing
 */
export const mcpRegistryNavigationAdapter: NavigationAdapter = {
  /**
   * Get URL for server detail page with specific version
   */
  goToServer: (serverName: string, version: string) => {
    const encodedName = encodeServerNameForRoute(serverName);
    return `/mcp-registry/servers/${encodedName}/${encodeURIComponent(version)}`;
  },
  
  /**
   * Get URL for all versions of a server
   */
  goToServerVersions: (serverName: string) => {
    const encodedName = encodeServerNameForRoute(serverName);
    return `/mcp-registry/servers/${encodedName}`;
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

