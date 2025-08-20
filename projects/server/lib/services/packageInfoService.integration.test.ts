import { packageInfoService } from './packageInfoService';

describe('PackageInfoService Integration Tests', () => {
  describe('getPackageInfo', () => {
    it('should fetch npm package info from real registry', async () => {
      const info = await packageInfoService.getPackageInfo('npm', 'react');
      
      expect(info.name).toBe('react');
      expect(info.registry).toBe('npm');
      expect(info.latestVersion).toBeDefined();
      expect(info.versions).toBeInstanceOf(Array);
      expect(info.versions.length).toBeGreaterThan(0);
      expect(info.description).toBeDefined();
      expect(info.repository).toContain('github.com/facebook/react');
      expect(info.homepage).toBeDefined();
      expect(info.license).toBeDefined();
      // Author might not always be present in npm registry
      if (info.author) {
        expect(info.author).toBeDefined();
      }
      expect(info.maintainers).toBeInstanceOf(Array);
      expect(info.keywords).toBeInstanceOf(Array);
      // Dependencies might not always be present
      if (info.dependencies) {
        expect(info.dependencies).toBeDefined();
      }
      expect(info.distTags).toBeDefined();
      expect(info.distTags!.latest).toBe(info.latestVersion);
    }, 10000); // 10 second timeout for network calls

    it('should fetch PyPI package info from real registry', async () => {
      const info = await packageInfoService.getPackageInfo('pypi', 'requests');
      
      expect(info.name).toBe('requests');
      expect(info.registry).toBe('pypi');
      expect(info.latestVersion).toBeDefined();
      expect(info.versions).toBeInstanceOf(Array);
      expect(info.versions.length).toBeGreaterThan(0);
      expect(info.description).toBeDefined();
      expect(info.repository).toContain('github.com/psf/requests');
      expect(info.homepage).toBeDefined();
      expect(info.license).toBeDefined();
      // Author might not always be present in PyPI registry
      if (info.author) {
        expect(info.author).toBeDefined();
      }
      // lastModified might not always be present in PyPI registry
      if (info.lastModified) {
        expect(info.lastModified).toBeDefined();
      }
    }, 10000);

    it('should handle non-existent npm package', async () => {
      await expect(
        packageInfoService.getPackageInfo('npm', 'this-package-does-not-exist-12345')
      ).rejects.toThrow('Failed to fetch npm package');
    }, 10000);

    it('should handle non-existent PyPI package', async () => {
      await expect(
        packageInfoService.getPackageInfo('pypi', 'this-package-does-not-exist-12345')
      ).rejects.toThrow('Failed to fetch PyPI package');
    }, 10000);
  });

  describe('checkForUpdates', () => {
    it('should detect npm package updates correctly', async () => {
      // Use a known older version
      const updateInfo = await packageInfoService.checkForUpdates('npm', 'react', '18.0.0');
      
      expect(updateInfo.hasUpdate).toBe(true);
      expect(updateInfo.currentVersion).toBe('18.0.0');
      expect(updateInfo.latestVersion).toBeDefined();
      expect(updateInfo.latestVersion).not.toBe('18.0.0');
    }, 10000);

    it('should detect PyPI package updates correctly', async () => {
      // Use a known older version
      const updateInfo = await packageInfoService.checkForUpdates('pypi', 'requests', '2.25.0');
      
      expect(updateInfo.hasUpdate).toBe(true);
      expect(updateInfo.currentVersion).toBe('2.25.0');
      expect(updateInfo.latestVersion).toBeDefined();
      expect(updateInfo.latestVersion).not.toBe('2.25.0');
    }, 10000);

    it('should detect no update when using latest version', async () => {
      // First get the latest version
      const info = await packageInfoService.getPackageInfo('npm', 'lodash');
      const updateInfo = await packageInfoService.checkForUpdates('npm', 'lodash', info.latestVersion);
      
      expect(updateInfo.hasUpdate).toBe(false);
      expect(updateInfo.currentVersion).toBe(info.latestVersion);
      expect(updateInfo.latestVersion).toBe(info.latestVersion);
    }, 10000);

    it('should detect no update for PyPI when using latest version', async () => {
      // First get the latest version
      const info = await packageInfoService.getPackageInfo('pypi', 'numpy');
      const updateInfo = await packageInfoService.checkForUpdates('pypi', 'numpy', info.latestVersion);
      
      expect(updateInfo.hasUpdate).toBe(false);
      expect(updateInfo.currentVersion).toBe(info.latestVersion);
      expect(updateInfo.latestVersion).toBe(info.latestVersion);
    }, 10000);
  });

  describe('real-world scenarios', () => {
    it('should handle packages with different metadata structures', async () => {
      // Test a package with minimal metadata
      const info = await packageInfoService.getPackageInfo('npm', 'lodash');
      
      expect(info.name).toBe('lodash');
      expect(info.latestVersion).toBeDefined();
      expect(info.versions.length).toBeGreaterThan(0);
      // Some packages might not have all fields
      expect(info.description).toBeDefined();
    }, 10000);

    it('should handle PyPI packages with different metadata', async () => {
      // Test a package with minimal metadata
      const info = await packageInfoService.getPackageInfo('pypi', 'numpy');
      
      expect(info.name).toBe('numpy');
      expect(info.latestVersion).toBeDefined();
      expect(info.versions.length).toBeGreaterThan(0);
      expect(info.description).toBeDefined();
    }, 10000);
  });
});
