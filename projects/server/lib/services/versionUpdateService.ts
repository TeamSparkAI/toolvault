import { McpServerConfig } from '@/lib/types/server';
import { wrapSecurity } from '@/lib/utils/security';
import { PackageExtractionService } from './packageExtractionService';

export class VersionUpdateService {
  static async createUpdatedConfig(
    originalConfig: McpServerConfig,
    newVersion: string
  ): Promise<McpServerConfig> {
    const analysis = PackageExtractionService.analyzeServerConfig(originalConfig);
    
    if (!analysis.packageInfo) {
      throw new Error('Cannot extract package information from server config');
    }
    
    const { packageInfo, isWrapped, unwrappedConfig } = analysis;
    
    // Create new args with updated version
    const newArgs = [...packageInfo.args];
    
    // Find the index of the package name in the args
    const packageIndex = newArgs.findIndex(arg => arg.startsWith(packageInfo.packageName));
    
    if (packageIndex === -1) {
      throw new Error(`Could not find package name '${packageInfo.packageName}' in args: ${newArgs.join(' ')}`);
    }
    
    // Update the package name at the correct index
    if (packageInfo.registry === 'npm') {
      newArgs[packageIndex] = `${packageInfo.packageName}@${newVersion}`;
    } else {
      newArgs[packageIndex] = `${packageInfo.packageName}==${newVersion}`;
    }
    
    // Ensure the unwrapped config is a stdio config
    if (unwrappedConfig.type !== 'stdio') {
      throw new Error('Unwrapped configuration is not a stdio configuration');
    }
    
    // Create new unwrapped config
    const newUnwrappedConfig: McpServerConfig = {
      ...unwrappedConfig,
      args: newArgs
    };
    
    // Apply same wrapping as original using existing utility
    if (isWrapped) {
      return wrapSecurity(newUnwrappedConfig);
    }
    
    return newUnwrappedConfig;
  }
}
