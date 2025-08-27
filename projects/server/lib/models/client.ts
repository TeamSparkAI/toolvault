import { ClientData } from "./types/client";

export abstract class ClientModel {
    abstract findById(clientId: number): Promise<ClientData | null>;
    abstract findByToken(token: string): Promise<ClientData | null>;
    abstract create(data: Omit<ClientData, 'clientId' | 'token' | 'createdAt' | 'updatedAt'> & { token?: string }): Promise<ClientData>;
    abstract update(clientId: number, data: Partial<Omit<ClientData, 'clientId' | 'token' | 'createdAt' | 'updatedAt'>>): Promise<ClientData>;
    abstract delete(clientId: number): Promise<boolean>;
    abstract list(): Promise<ClientData[]>;
    abstract updateLastUpdated(clientId: number): Promise<ClientData>;
    abstract updateLastScanned(clientId: number): Promise<ClientData>;
    abstract getByIds(clientIds: number[]): Promise<ClientData[]>;
} 