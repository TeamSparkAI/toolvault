/**
 * Utility functions for encoding/decoding server names in URL routes
 * Server names can contain '/' (e.g., "ai.aliengiraffe/spotdb")
 * We replace '/' with '--' to avoid Next.js routing conflicts
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

