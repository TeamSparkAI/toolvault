import { ModelFactory } from '../models';
import { packageInfoService } from './packageInfoService';
import { PackageExtractionService } from './packageExtractionService';
import { VersionUpdateService } from './versionUpdateService';
import { McpClientStdio } from './mcpClientServer';
import { logger } from '../logging/server';
import { Tool } from '@modelcontextprotocol/sdk/types';
import { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio';

export interface SecurityValidationResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  serverInfo: { name: string; version: string } | null;
  tools: Tool[];
  validationTime: Date;
  errorLog?: string[];
}

export class SecurityValidationService {
  static async validateServerUpdate(serverId: number, targetVersion?: string): Promise<SecurityValidationResult> {
    const serverModel = await ModelFactory.getInstance().getServerModel();
    const serverData = await serverModel.findById(serverId);
    if (!serverData) {
      throw new Error('Server not found');
    }
    
    // Use existing utility to analyze config
    const analysis = PackageExtractionService.analyzeServerConfig(serverData.config);
    if (!analysis.packageInfo) {
      throw new Error('Server configuration does not contain package information');
    }
    
    const { packageInfo } = analysis;
    
    // Get package info to determine latest version
    const packageInfoResult = await packageInfoService.getPackageInfo(
      packageInfo.registry,
      packageInfo.packageName
    );
    
    // Determine which version to run
    const versionToRun = targetVersion || packageInfoResult.latestVersion;
    const currentVersion = packageInfo.currentVersion || '';
    const hasUpdate = currentVersion !== packageInfoResult.latestVersion;
    
    // Create configuration for the target version
    const targetConfig = await VersionUpdateService.createUpdatedConfig(
      serverData.config,
      versionToRun
    );
    
    // Log the MCP config being used
    logger.info(`Security validation using MCP config:`, {
      serverId,
      targetVersion,
      versionToRun,
      configType: targetConfig.type,
      command: targetConfig.type === 'stdio' ? targetConfig.command : 'N/A',
      args: targetConfig.type === 'stdio' ? targetConfig.args : 'N/A',
      env: targetConfig.type === 'stdio' ? targetConfig.env : 'N/A',
      cwd: targetConfig.type === 'stdio' ? targetConfig.cwd : 'N/A'
    });
    
    // Ensure the target config is a stdio config
    if (targetConfig.type !== 'stdio') {
      throw new Error('Target configuration is not a stdio configuration');
    }
    
    // Create stdio parameters for the target config
    const stdioParams: StdioServerParameters = {
      command: targetConfig.command,
      args: targetConfig.args,
      env: targetConfig.env,
      cwd: targetConfig.cwd
    };
    
    // Execute using existing MCP client infrastructure
    const client = new McpClientStdio(stdioParams);
    
    try {
      const connected = await client.connect();
      if (!connected) {
        throw new Error('Failed to connect to MCP server');
      }
      
      return {
        hasUpdate,
        currentVersion,
        latestVersion: packageInfoResult.latestVersion,
        serverInfo: client.serverVersion,
        tools: client.serverTools,
        validationTime: new Date()
      };
    } catch (error) {
      logger.error(`Failed to connect to server version ${versionToRun} for validation:`, error);
      
      // Get error logs from the client
      const errorLog = client.getErrorLog();
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Use client error log if available, otherwise fall back to caught error
      const allErrors = errorLog.length > 0 ? errorLog : [errorMessage];
      
      // Return a validation result with error information instead of throwing
      return {
        hasUpdate,
        currentVersion,
        latestVersion: packageInfoResult.latestVersion,
        serverInfo: null,
        tools: [],
        validationTime: new Date(),
        errorLog: allErrors
      };
    } finally {
      await client.disconnect();
    }
  }
}
