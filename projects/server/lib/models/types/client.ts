import { ClientType } from "@/lib/types/clientType";

export type ClientScope = 'global' | 'project';

// Client uses | null and ClientData uses ? for optional fields.  This is because Client is used in the UI and ClientData is used in the API.

export interface Client {
  clientId: number;
  token?: string;
  type: ClientType;
  scope: ClientScope;
  name: string;
  description: string | null;
  configPath: string | null;
  autoUpdate: boolean;
  enabled: boolean;
  lastUpdated?: string | null;
  lastScanned?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientData {
    clientId: number;
    token: string;
    type: ClientType;
    scope: ClientScope;
    name: string;
    description?: string;
    configPath?: string;
    autoUpdate: boolean;
    enabled: boolean;
    lastUpdated?: string;
    lastScanned?: string;
    createdAt: string;
    updatedAt: string;
}