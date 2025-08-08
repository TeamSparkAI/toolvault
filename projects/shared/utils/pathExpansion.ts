import * as os from 'os';
import * as path from 'path';

// !!! This is not Windows friendly.  We should probably treat %USERPROFILE% like ~ and $HOME.
//     We might also consider supporting %APPDATA%, %TEMP%, etc as path starters only.

/**
 * Type for environment variables that can be undefined
 */
export type EnvironmentRecord = Record<string, string | undefined>;

/**
 * Safely get the home directory, falling back to a reasonable default if it fails
 */
function getHomeDirectory(): string {
    try {
        return os.homedir();
    } catch (error) {
        // Fallback to a reasonable default if os.homedir() fails
        // This can happen in containerized environments or unusual system configurations
        return process.env.HOME || process.env.USERPROFILE || '/tmp';
    }
}

/**
 * Expands a path string by resolving:
 * - Home directory expansion (~)
 * - Environment variable substitution ($VAR or ${VAR})
 * - Special handling for $HOME (only at start of path)
 * 
 * @param inputPath - The path string to expand
 * @param env - Optional environment object (defaults to process.env)
 * @returns The expanded path
 */
export function expandPath(inputPath: string, env: EnvironmentRecord = process.env): string {
    if (!inputPath) {
        return inputPath;
    }

    let expandedPath = inputPath;

    // Expand home directory (~)
    if (expandedPath.startsWith('~')) {
        try {
            const homeDir = getHomeDirectory();
            expandedPath = expandedPath.replace(/^~/, homeDir);
        } catch (error) {
            // If home directory expansion fails, leave the path unchanged
            // This prevents the entire expansion from failing due to home dir issues
        }
    }

    // Special handling for $HOME - only expand at the start of the path
    if (expandedPath.startsWith('$HOME/') || expandedPath === '$HOME') {
        try {
            const homeDir = getHomeDirectory();
            expandedPath = expandedPath.replace(/^\$HOME/, homeDir);
        } catch (error) {
            // If home directory expansion fails, leave the path unchanged
        }
    }

    // Expand environment variables with more precise matching
    // ${VAR} - takes everything between curly braces
    // $VAR - only matches if it looks like a valid env var name
    // Exclude $HOME from general expansion since we handled it specially above
    expandedPath = expandedPath.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/g, (match, bracedVarName, simpleVarName) => {
        const envVarName = bracedVarName || simpleVarName;
        
        // Skip $HOME since we handled it specially above
        if (envVarName === 'HOME') {
            return match; // Keep original $HOME
        }
        
        // Additional validation for simple $VAR format
        if (simpleVarName) {
            // Single underscore is not a valid env var
            if (simpleVarName === '_') {
                return match; // Not a valid env var, keep original
            }
            
            // Can't end with underscore
            if (simpleVarName.endsWith('_')) {
                return match; // Not a valid env var, keep original
            }
        }
        
        const envValue = env[envVarName];
        
        if (envValue === undefined) {
            // If environment variable is not found, keep the original match
            return match;
        }
        
        return envValue;
    });

    return expandedPath;
}

/**
 * Expands multiple paths in an array
 * 
 * @param paths - Array of path strings to expand
 * @param env - Optional environment object (defaults to process.env)
 * @returns Array of expanded paths
 */
export function expandPaths(paths: string[], env: EnvironmentRecord = process.env): string[] {
    return paths.map(path => {
        try {
            return expandPath(path, env);
        } catch (error) {
            // If expansion fails for a single path, return the original
            return path;
        }
    });
}

/**
 * Normalizes and expands a path, resolving relative paths and expanding home/environment variables
 * 
 * @param inputPath - The path to normalize and expand
 * @param env - Optional environment object (defaults to process.env)
 * @returns The normalized and expanded absolute path
 */
export function resolveExpandedPath(inputPath: string, env: EnvironmentRecord = process.env): string {
    const expandedPath = expandPath(inputPath, env);
    try {
        return path.resolve(expandedPath);
    } catch (error) {
        // If path resolution fails, return the expanded path as-is
        // This prevents path.resolve() errors from breaking the function
        return expandedPath;
    }
} 