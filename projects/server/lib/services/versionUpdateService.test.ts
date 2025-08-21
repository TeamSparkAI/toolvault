import { VersionUpdateService } from './versionUpdateService';
import { McpServerConfig } from '../types/server';

describe('VersionUpdateService', () => {
  describe('createUpdatedConfig', () => {
    it('should update npm package version in unwrapped config', async () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-fetch@1.0.0']
      };

      const result = await VersionUpdateService.createUpdatedConfig(config, '2.0.0');

      expect(result).toEqual({
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-fetch@2.0.0']
      });
    });

    it('should update PyPI package version in unwrapped config', async () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'uvx',
        args: ['mcp-server-fetch==1.0.0']
      };

      const result = await VersionUpdateService.createUpdatedConfig(config, '2.0.0');

      expect(result).toEqual({
        type: 'stdio',
        command: 'uvx',
        args: ['mcp-server-fetch==2.0.0']
      });
    });

    it('should update npm package version in wrapped config', async () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'docker',
        args: ['run', '--rm', '-i', 'teamspark/npx-runner:latest', 'npx', '@modelcontextprotocol/server-fetch@1.0.0']
      };

      const result = await VersionUpdateService.createUpdatedConfig(config, '2.0.0');

      // Should return a wrapped config with updated version
      expect(result.command).toBe('docker');
      expect(result.args).toContain('@modelcontextprotocol/server-fetch@2.0.0');
    });

    it('should throw error for config without package info', async () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'python',
        args: ['server.py']
      };

      await expect(
        VersionUpdateService.createUpdatedConfig(config, '2.0.0')
      ).rejects.toThrow('Cannot extract package information from server config');
    });
  });
});
