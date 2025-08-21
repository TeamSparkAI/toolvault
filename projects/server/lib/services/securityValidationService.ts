import { McpServerConfig } from '@/lib/types/server';
import { VersionUpdateService } from './versionUpdateService';
import { McpClientStdio } from './mcpClientServer';
import { logger } from '../logging/server';
import { Tool } from '@modelcontextprotocol/sdk/types';
import { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio';

export interface SecurityValidationResult {
  packageVersion: string;
  serverInfo: { name: string; version: string } | null;
  tools: Tool[];
  validationTime: Date;
  errorLog?: string[];
}

export class SecurityValidationService {
  static async validateServerUpdate(originalConfig: McpServerConfig, targetVersion: string): Promise<SecurityValidationResult> {
    // Create configuration for the target version
    const targetConfig = await VersionUpdateService.createUpdatedConfig(
      originalConfig,
      targetVersion
    );
    
    // Log the MCP config being used
    logger.info(`Security validation using MCP config:`, {
      targetVersion,
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
        packageVersion: client.serverVersion?.version || targetVersion,
        serverInfo: client.serverVersion,
        tools: client.serverTools,
        validationTime: new Date()
      };
    } catch (error) {
      logger.error(`Failed to connect to server version ${targetVersion} for validation:`, error);
      
      // Get error logs from the client
      const errorLog = client.getErrorLog();
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Use client error log if available, otherwise fall back to caught error
      const allErrors = errorLog.length > 0 ? errorLog : [errorMessage];
      
      // Return a validation result with error information instead of throwing
      return {
        packageVersion: targetVersion, // Use requested version since validation failed
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
