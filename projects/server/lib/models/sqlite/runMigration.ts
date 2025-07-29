import { initializeDatabase } from './init';
import { logger } from '@/lib/logging/server';

// Run migrations if this file is executed directly
if (require.main === module) {
  initializeDatabase().catch(logger.error);
} 