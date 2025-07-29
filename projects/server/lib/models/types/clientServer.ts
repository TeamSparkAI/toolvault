export interface ClientServerData {
    clientServerId: number;
    clientId: number;
    serverId: number | null;
    clientServerName: string | null;
    toolNames?: string[];
    syncState?: 'add' | 'deleteScanned' | 'deletePushed' | 'pushed' | 'scanned';
    createdAt: string;
    updatedAt: string;
}

export interface ClientServerFilter {
    clientId?: number;
    serverId?: number | null;
}