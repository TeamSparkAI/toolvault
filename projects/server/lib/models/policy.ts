import { PolicyData } from "./types/policy";

export abstract class PolicyModel {
    abstract findById(policyId: number): Promise<PolicyData | null>;
    abstract create(data: Omit<PolicyData, 'policyId' | 'createdAt' | 'updatedAt'>): Promise<PolicyData>;
    abstract update(policyId: number, data: Partial<PolicyData>): Promise<PolicyData>;
    abstract delete(policyId: number): Promise<boolean>;
    abstract list(): Promise<PolicyData[]>;
    abstract getByIds(policyIds: number[]): Promise<PolicyData[]>;
} 