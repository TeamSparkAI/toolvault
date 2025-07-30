import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '@/lib/logging/server';

/**
 * Utility function to find static files in multiple locations
 * 
 * This function searches for appData directories in the following order:
 * 1. Production: relative to dist root (process.cwd()/appData/subDir)
 * 2. Development: relative to source (__dirname/../../appData/subDir)  
 * 3. Fallback: relative to bundled module (__dirname/appData/subDir)
 * 
 * @param subDir - The subdirectory within appData to find (e.g., 'migrations', 'data')
 * @returns The absolute path to the found directory
 * @throws Error if the directory cannot be found in any expected location
 */
export function findStaticDir(subDir: string): string {
  const possiblePaths = [
    join(process.cwd(), 'appData', subDir),               // Production: relative to dist root
    join(__dirname, '..', '..', '..', 'appData', subDir), // Development: relative to source
    join(__dirname, 'appData', subDir),                   // Fallback: relative to bundled module
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      logger.debug(`Found ${subDir} directory at: ${path}`);
      return path;
    }
  }
  
  throw new Error(`Could not find ${subDir} directory in any of the expected locations`);
} 