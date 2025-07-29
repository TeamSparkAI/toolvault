import { Server } from '@/lib/types/server';
import { unwrapSecurity } from './security';
import { log } from '@/lib/logging/console';

/**
 * Generates a human-readable summary for a server configuration
 * For wrapped servers, shows the unwrapped command instead of "docker"
 */
export function getServerDisplayInfo(server: Server): string {
  if (server.config.type === 'sse' || server.config.type === 'streamable') {
    const url = server.config.url || '';
    if (url) {
      try {
        const urlObj = new URL(url);
        return `${server.config.type} - ${urlObj.host}`;
      } catch (e) {
        // If URL parsing fails, just show the URL as is
        return `${server.config.type} - ${url}`;
      }
    }
    return `${server.config.type} - No URL specified`;
  } else {
    // For stdio servers, show command
    let command = server.config.command || '';
    
    // If this is a wrapped server, use the unwrapped command instead of "docker"
    if (server.security === 'wrapped') {
      try {
        const unwrappedConfig = unwrapSecurity(server.config);
        if (unwrappedConfig.type === 'stdio') {
          command = unwrappedConfig.command || '';
        }
      } catch (e) {
        // If unwrapping fails, fall back to the original command
        log.warn('Failed to unwrap security for display:', e);
      }
    }
    
    return `${server.config.type ?? "stdio"} - ${command || 'No command specified'}`;
  }
} 