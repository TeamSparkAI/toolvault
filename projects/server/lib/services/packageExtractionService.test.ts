import { PackageExtractionService } from './packageExtractionService';
import { McpServerConfig } from '../types/server';

describe('PackageExtractionService', () => {
  describe('extractPackageInfo', () => {
    it('should extract npm package info from unwrapped config', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['package-name']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toEqual({
        registry: 'npm',
        packageName: 'package-name',
        currentVersion: undefined,
        command: 'npx',
        args: ['package-name']
      });
    });

    it('should extract npm package info with version from unwrapped config', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['package-name@1.2.3']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toEqual({
        registry: 'npm',
        packageName: 'package-name',
        currentVersion: '1.2.3',
        command: 'npx',
        args: ['package-name@1.2.3']
      });
    });

    it('should extract npm package info with flags before package name', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['--yes', '--quiet', 'package-name']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toEqual({
        registry: 'npm',
        packageName: 'package-name',
        currentVersion: undefined,
        command: 'npx',
        args: ['--yes', '--quiet', 'package-name']
      });
    });

    it('should extract npm package info with version and flags before package name', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['--yes', 'package-name@1.2.3', '--arg1', 'value1']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toEqual({
        registry: 'npm',
        packageName: 'package-name',
        currentVersion: '1.2.3',
        command: 'npx',
        args: ['--yes', 'package-name@1.2.3', '--arg1', 'value1']
      });
    });

    it('should extract PyPI package info from unwrapped config', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'uvx',
        args: ['package-name']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toEqual({
        registry: 'pypi',
        packageName: 'package-name',
        currentVersion: undefined,
        command: 'uvx',
        args: ['package-name']
      });
    });

    it('should extract PyPI package info with version from unwrapped config', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'uvx',
        args: ['package-name==1.2.3']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toEqual({
        registry: 'pypi',
        packageName: 'package-name',
        currentVersion: '1.2.3',
        command: 'uvx',
        args: ['package-name==1.2.3']
      });
    });

    it('should extract PyPI package info with flags before package name', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'uvx',
        args: ['--python', '3.11', '--quiet', 'package-name']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toEqual({
        registry: 'pypi',
        packageName: 'package-name',
        currentVersion: undefined,
        command: 'uvx',
        args: ['--python', '3.11', '--quiet', 'package-name']
      });
    });

    it('should extract PyPI package info with version and flags before package name', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'uvx',
        args: ['--python', '3.11', 'package-name==1.2.3', '--arg1', 'value1']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toEqual({
        registry: 'pypi',
        packageName: 'package-name',
        currentVersion: '1.2.3',
        command: 'uvx',
        args: ['--python', '3.11', 'package-name==1.2.3', '--arg1', 'value1']
      });
    });

    it('should return null for non-stdio config', () => {
      const config: McpServerConfig = {
        type: 'sse',
        url: 'http://example.com'
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toBeNull();
    });

    it('should return null for stdio config with non-npx/uvx command', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'python',
        args: ['script.py']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toBeNull();
    });

    it('should return null when only flags are provided', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['--yes', '--quiet']
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toBeNull();
    });

    it('should return null for empty args', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: []
      };

      const result = PackageExtractionService.extractPackageInfo(config);

      expect(result).toBeNull();
    });
  });

  describe('analyzeServerConfig', () => {
    it('should analyze unwrapped npm config', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['package-name']
      };

      const result = PackageExtractionService.analyzeServerConfig(config);

      expect(result.packageInfo).toEqual({
        registry: 'npm',
        packageName: 'package-name',
        currentVersion: undefined,
        command: 'npx',
        args: ['package-name']
      });
      expect(result.isWrappable).toBe(true);
      expect(result.isWrapped).toBe(false);
      expect(result.unwrappedConfig).toEqual(config);
    });

    it('should analyze wrapped npm config', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'docker',
        args: ['run', '--rm', '-i', 'teamspark/npx-runner:latest', 'npx', 'package-name']
      };

      const result = PackageExtractionService.analyzeServerConfig(config);

      expect(result.packageInfo).toEqual({
        registry: 'npm',
        packageName: 'package-name',
        currentVersion: undefined,
        command: 'npx',
        args: ['package-name']
      });
      expect(result.isWrappable).toBe(true);
      expect(result.isWrapped).toBe(true);
      expect(result.unwrappedConfig).toEqual({
        type: 'stdio',
        command: 'npx',
        args: ['package-name']
      });
    });

    it('should analyze unwrapped npm config with flags', () => {
      const config: McpServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['--yes', '--quiet', 'package-name@1.2.3']
      };

      const result = PackageExtractionService.analyzeServerConfig(config);

      expect(result.packageInfo).toEqual({
        registry: 'npm',
        packageName: 'package-name',
        currentVersion: '1.2.3',
        command: 'npx',
        args: ['--yes', '--quiet', 'package-name@1.2.3']
      });
      expect(result.isWrappable).toBe(true);
      expect(result.isWrapped).toBe(false);
      expect(result.unwrappedConfig).toEqual(config);
    });
  });
});
