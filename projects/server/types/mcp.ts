export type McpServerStatus = 'running' | 'stopped' | 'error'

import type { McpServerConfig } from '@/lib/types/server';

export interface McpServer {
  name: string
  status: McpServerStatus
  url: string
  lastSeen: string
  version: string
  config: McpServerConfig
}

export interface ApiError {
  error: string
} 