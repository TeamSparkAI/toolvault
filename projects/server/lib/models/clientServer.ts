import { ClientServerData, ClientServerFilter } from "@/lib/models/types/clientServer";

export abstract class ClientServerModel {
    abstract findById(clientServerId: number): Promise<ClientServerData | null>;
    abstract findByClientAndServer(clientId: number, serverId: number | null): Promise<ClientServerData | null>;
    abstract create(data: Omit<ClientServerData, 'clientServerId' | 'createdAt' | 'updatedAt'>): Promise<ClientServerData>;
    abstract update(clientServerId: number, data: Partial<Omit<ClientServerData, 'clientServerId' | 'createdAt' | 'updatedAt'>>): Promise<ClientServerData>;
    abstract delete(clientServerId: number): Promise<void>;
    abstract list(filter: ClientServerFilter): Promise<ClientServerData[]>;
} 