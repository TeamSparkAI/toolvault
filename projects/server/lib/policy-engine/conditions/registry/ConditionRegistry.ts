import { PolicyConditionBase } from "../PolicyConditionBase";
import { RegexCondition } from "../PolicyConditionRegex";

export class ConditionRegistry {
    private static instance: ConditionRegistry;
    private conditionInstances = new Map<string, PolicyConditionBase>();
    
    private constructor() {
        // Private constructor for singleton
    }
    
    /**
     * Get the singleton instance and initialize with all available conditions
     */
    private static getInstance(): ConditionRegistry {
        if (!ConditionRegistry.instance) {
            ConditionRegistry.instance = new ConditionRegistry();
            
            // Register all available condition instances
            ConditionRegistry.instance.register(new RegexCondition());
            
            // TODO: Add more conditions as they are implemented
            // ConditionRegistry.instance.register(new DlpCondition());
            // ConditionRegistry.instance.register(new PinningCondition());
            // ConditionRegistry.instance.register(new SecretScannerCondition());
        }
        return ConditionRegistry.instance;
    }
    
    /**
     * Register a condition instance (private - only called internally)
     */
    private register(conditionInstance: PolicyConditionBase): void {
        this.conditionInstances.set(conditionInstance.classId, conditionInstance);
    }
    
    /**
     * Get all available condition instances
     */
    static getAvailableConditions(): PolicyConditionBase[] {
        return Array.from(ConditionRegistry.getInstance().conditionInstances.values());
    }
    
    /**
     * Get a specific condition instance by class ID
     */
    static getCondition(classId: string): PolicyConditionBase | undefined {
        return ConditionRegistry.getInstance().conditionInstances.get(classId);
    }
}
