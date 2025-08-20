import fetch from 'npm-registry-fetch';
import { getPackage } from 'pypi-info';
import { logger } from '@/lib/logging/server';

export interface PackageInfo {
  name: string;
  latestVersion: string;
  versions: string[];
  description?: string;
  repository?: string;
  homepage?: string;
  license?: string;
  author?: string;
  maintainers?: string[];
  keywords?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  distTags?: Record<string, string>;
  lastModified?: string;
  registry: 'npm' | 'pypi';
}

export interface PackageUpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
}

export interface PackageInfoService {
  getPackageInfo(registry: 'npm' | 'pypi', packageName: string): Promise<PackageInfo>;
  checkForUpdates(registry: 'npm' | 'pypi', packageName: string, currentVersion: string): Promise<PackageUpdateInfo>;
}

export class PackageInfoServiceImpl implements PackageInfoService {
  private static instance: PackageInfoServiceImpl;

  private constructor() {}

  public static getInstance(): PackageInfoServiceImpl {
    if (!PackageInfoServiceImpl.instance) {
      PackageInfoServiceImpl.instance = new PackageInfoServiceImpl();
    }
    return PackageInfoServiceImpl.instance;
  }

  private async getNpmPackageInfo(packageName: string): Promise<PackageInfo> {
    try {
      const data = await fetch.json(`/${packageName}`) as any;

      return {
        name: packageName,
        latestVersion: data['dist-tags'].latest,
        versions: Object.keys(data.versions),
        description: data.description,
        repository: data.repository?.url,
        homepage: data.homepage,
        license: data.license,
        author: typeof data.author === 'string' ? data.author : data.author?.name,
        maintainers: data.maintainers?.map((m: any) => m.name),
        keywords: data.keywords,
        dependencies: data.versions[data['dist-tags'].latest]?.dependencies,
        devDependencies: data.versions[data['dist-tags'].latest]?.devDependencies,
        peerDependencies: data.versions[data['dist-tags'].latest]?.peerDependencies,
        distTags: data['dist-tags'],
        lastModified: data.time?.modified,
        registry: 'npm'
      };
    } catch (error) {
      logger.error(`Failed to get npm package info for ${packageName}:`, error);
      throw new Error(`Failed to fetch npm package ${packageName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getPyPIPackageInfo(packageName: string): Promise<PackageInfo> {
    try {
      const data = await getPackage(packageName) as any;

      return {
        name: packageName,
        latestVersion: data.info.version,
        versions: Object.keys(data.releases),
        description: data.info.summary,
        repository: data.info.project_urls?.Source || data.info.project_urls?.Repository,
        homepage: data.info.home_page,
        license: data.info.license,
        author: data.info.author,
        maintainers: data.info.maintainer ? [data.info.maintainer] : undefined,
        keywords: data.info.keywords ? data.info.keywords.split(',').map((k: string) => k.trim()) : undefined,
        lastModified: data.info.upload_time,
        registry: 'pypi'
      };
    } catch (error) {
      logger.error(`Failed to get PyPI package info for ${packageName}:`, error);
      throw new Error(`Failed to fetch PyPI package ${packageName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPackageInfo(registry: 'npm' | 'pypi', packageName: string): Promise<PackageInfo> {
    if (registry === 'npm') {
      return this.getNpmPackageInfo(packageName);
    } else {
      return this.getPyPIPackageInfo(packageName);
    }
  }

  async checkForUpdates(registry: 'npm' | 'pypi', packageName: string, currentVersion: string): Promise<PackageUpdateInfo> {
    try {
      const info = await this.getPackageInfo(registry, packageName);

      return {
        hasUpdate: currentVersion !== info.latestVersion,
        currentVersion,
        latestVersion: info.latestVersion
      };
    } catch (error) {
      logger.error(`Failed to check for updates for ${packageName}:`, error);
      throw new Error(`Failed to check for updates for ${packageName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const packageInfoService = PackageInfoServiceImpl.getInstance();
