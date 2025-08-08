import { join } from 'path';
import { getAppDataPath } from '../../../../shared/utils/paths';

export const DB_CONFIG = {
  // Database file path in app data directory
  filename: 'toolvault.sqlite',
  
  // Get full database path
  getPath: () => join(getAppDataPath(), DB_CONFIG.filename),
  
  // Database options
  options: {
    verbose: process.env.NODE_ENV === 'development',
  }
} as const; 