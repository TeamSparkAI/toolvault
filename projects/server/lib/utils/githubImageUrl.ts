import { ServerCatalogEntry } from "@/types/server-catalog";

export function getServerCatalogIconUrl(server: ServerCatalogEntry): string {
  return server.icon ?? '/mcp_black.png';
}

// Type-safe interface for objects that have catalog icon information
interface HasCatalogIcon {
  serverCatalogIcon?: string;
}

export function getServerIconUrl(server: HasCatalogIcon | null | undefined): string {
  return server?.serverCatalogIcon ?? '/mcp_black.png';
}