import { PolicyElementData, PolicyElementCreateData, PolicyElementUpdateData, PolicyElementFilter } from './types/policyElement';

export abstract class PolicyElementModel {
    abstract findById(configId: number): Promise<PolicyElementData | null>;
    abstract create(data: PolicyElementCreateData): Promise<PolicyElementData>;
    abstract update(configId: number, data: PolicyElementUpdateData): Promise<PolicyElementData>;
    abstract delete(configId: number): Promise<boolean>;
    abstract list(filter?: PolicyElementFilter): Promise<PolicyElementData[]>;
    abstract findByClassName(className: string): Promise<PolicyElementData[]>;
}
