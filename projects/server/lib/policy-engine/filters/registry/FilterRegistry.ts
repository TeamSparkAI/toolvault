import { PolicyFilterBase } from "../PolicyFilterBase";
import { RegexFilter } from "../PolicyFilterRegex";

export class FilterRegistry {
    private static instance: FilterRegistry;
    private filterInstances = new Map<string, PolicyFilterBase>();
    
    private constructor() {
        // Private constructor for singleton
    }
    
    /**
     * Get the singleton instance and initialize with all available filters
     */
    private static getInstance(): FilterRegistry {
        if (!FilterRegistry.instance) {
            FilterRegistry.instance = new FilterRegistry();
            
            // Register all available filter instances
            FilterRegistry.instance.register(new RegexFilter());
            
            // TODO: Add more filters as they are implemented
            // FilterRegistry.instance.register(new DlpFilter());
            // FilterRegistry.instance.register(new PinningFilter());
            // FilterRegistry.instance.register(new SecretScannerFilter());
        }
        return FilterRegistry.instance;
    }
    
    /**
     * Register a filter instance (private - only called internally)
     */
    private register(filterInstance: PolicyFilterBase): void {
        this.filterInstances.set(filterInstance.classId, filterInstance);
    }
    
    /**
     * Get all available filter instances
     */
    static getAvailableFilters(): PolicyFilterBase[] {
        return Array.from(FilterRegistry.getInstance().filterInstances.values());
    }
    
    /**
     * Get a specific filter instance by class ID
     */
    static getFilter(classId: string): PolicyFilterBase | undefined {
        return FilterRegistry.getInstance().filterInstances.get(classId);
    }
}
