import { PolicyActionBase } from "../PolicyActionBase";
import { PolicyActionRewrite } from "../PolicyActionRewrite";
import { PolicyActionError } from "../PolicyActionError";

export class ActionRegistry {
    private static instance: ActionRegistry;
    private actionInstances = new Map<string, PolicyActionBase>();
    
    private constructor() {
        // Private constructor for singleton
    }
    
    /**
     * Get the singleton instance and initialize with all available actions
     */
    private static getInstance(): ActionRegistry {
        if (!ActionRegistry.instance) {
            ActionRegistry.instance = new ActionRegistry();
            
            // Register all available action instances
            ActionRegistry.instance.register(new PolicyActionRewrite());
            ActionRegistry.instance.register(new PolicyActionError());
            
            // TODO: Add more actions as they are implemented
            // ActionRegistry.instance.register(new LogAction());
            // ActionRegistry.instance.register(new SiemAction());
            // ActionRegistry.instance.register(new OpenTelemetryAction());
        }
        return ActionRegistry.instance;
    }
    
    /**
     * Register an action instance (private - only called internally)
     */
    private register(actionInstance: PolicyActionBase): void {
        this.actionInstances.set(actionInstance.classId, actionInstance);
    }
    
    /**
     * Get all available action instances
     */
    static getAvailableActions(): PolicyActionBase[] {
        return Array.from(ActionRegistry.getInstance().actionInstances.values());
    }
    
    /**
     * Get a specific action instance by class ID
     */
    static getAction(classId: string): PolicyActionBase | undefined {
        return ActionRegistry.getInstance().actionInstances.get(classId);
    }
}
