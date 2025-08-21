import { McpServerConfig } from '@/lib/types/server';
import { isSecurityUnwrappable, unwrapSecurity } from '@/lib/utils/security';

export interface ExtractedPackageInfo {
  registry: 'npm' | 'pypi';
  packageName: string;
  currentVersion?: string;
  command: string;  // 'npx' or 'uvx'
  args: string[];   // original args
}

export interface ServerConfigAnalysis {
  packageInfo: ExtractedPackageInfo | null;
  isWrappable: boolean;
  isWrapped: boolean;
  unwrappedConfig: McpServerConfig;
}

export class PackageExtractionService {
  // Generally the args passed to npx and uvx that can occur before the package name are unary.  There are some exceptions, 
  // where an arg has a value in the following arg.  In order to get to the positional package name, we need to skip all
  // unary args and any args with parameters in their following arg.  In addition, there are args that can specify the package
  // name (instead of relhying on it being the first positional non-arg value), so we need to look for those.  The following
  // logic in findPackageName implements this.
  //

  // npx: -p <package-name>, --package <package-name>, or --package=<package-name>, where package name can use @ for a version (tag or number)
  private static readonly npxValueFlagsWithArgFollowing = [
    '-c', '--call'
  ];

  // uvx: --from <package-name>, where package name can use == for an exact version
  private static readonly uvxValueFlagsWithArgFollowing = [
    '-p', '--python', '--cache-dir', '-i', '--index-url', '--extra-index-url', '-f', '--find-links'
  ];

  private static findPackageName(args: string[], command: string): string | null {
    // Skip flags until we find the first non-flag argument
    // Single dash: skip just the flag
    // Double dash: skip the flag and its value if it's a known value-taking flag
    const valueFlagsWithArgFollowing = command === 'npx' ? this.npxValueFlagsWithArgFollowing : this.uvxValueFlagsWithArgFollowing;
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // If it starts with -p or --package, then see if it contains an =, and if so, the part after the = is the package name (and optional @version), 
      // if not, the next arg is the package name (and optional @version)
      if (command === 'npx' && (arg.startsWith('-p') || arg.startsWith('--package'))) {
        const equalsIndex = arg.indexOf('=');
        if (equalsIndex !== -1) {
          return arg.slice(equalsIndex + 1);
        }
        if (args.length > i + 1) {
          return args[i + 1];
        }
        return null; // No next arg to be package name (invalid config)
      }

      if (command === 'uvx' && arg.startsWith('--from')) {
        if (args.length > i + 1) {
          return args[i + 1];
        }
        return null; // No next arg to be package name (invalid config)
      }
      
      if (valueFlagsWithArgFollowing.includes(arg)) {
        i++; // Skip the next argument as it's the value for this flag
        continue;
      } else if (arg.startsWith('-')) {
        // Flag (single or double dash) - skip just this argument
        continue;
      }
      
      // This is the first non-flag argument - should be the package name
      return arg;
    }
    
    return null;
  }

  static extractPackageInfo(config: McpServerConfig): ExtractedPackageInfo | null {
    // Use existing utility to determine if wrapped
    const isWrapped = isSecurityUnwrappable(config);
    
    // Unwrap if needed to get the base config
    const unwrappedConfig = isWrapped ? unwrapSecurity(config) : config;
    
    if (unwrappedConfig.type !== 'stdio') {
      return null;
    }
    
    const { command, args } = unwrappedConfig;
    
    // Handle npx commands
    if (command === 'npx') {
      if (args.length === 0) return null;
      
      const packageName = this.findPackageName(args, command);
      if (!packageName) return null;
      
      const versionMatch = packageName.match(/^(.+)@(.+)$/);
      
      return {
        registry: 'npm',
        packageName: versionMatch ? versionMatch[1] : packageName,
        currentVersion: versionMatch ? versionMatch[2] : undefined,
        command: 'npx',
        args: args
      };
    }
    
    // Handle uvx commands
    if (command === 'uvx') {
      if (args.length === 0) return null;
      
      const packageName = this.findPackageName(args, command);
      if (!packageName) return null;
      
      const versionMatch = packageName.match(/^(.+)==(.+)$/);
      
      return {
        registry: 'pypi',
        packageName: versionMatch ? versionMatch[1] : packageName,
        currentVersion: versionMatch ? versionMatch[2] : undefined,
        command: 'uvx',
        args: args
      };
    }
    
    return null;
  }
  
  static analyzeServerConfig(config: McpServerConfig): ServerConfigAnalysis {
    const packageInfo = this.extractPackageInfo(config);
    const isWrapped = isSecurityUnwrappable(config);
    const isWrappable = packageInfo !== null; // If we can extract package info, it's wrappable
    const unwrappedConfig = isWrapped ? unwrapSecurity(config) : config;
    
    return {
      packageInfo,
      isWrappable,
      isWrapped,
      unwrappedConfig
    };
  }
}
