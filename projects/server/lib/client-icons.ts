import { ClientType } from "./types/clientType";

export const getClientIcon = (type: ClientType): string => {
  const iconMap: Record<ClientType, string> = {
    'cursor': '/assets/cursor_256.png',
    'windsurf': '/assets/windsurf_black_256.png',
    'claudecode': '/assets/anthropic_256.png',
    'roocode': '/assets/roocode_black_256.png',
    'vscode': '/assets/vscode_256.png',
    'generic': '/assets/generic_256.png',
    'ttv': '/icon.png'
  };
  return iconMap[type] || iconMap['generic'];
}; 