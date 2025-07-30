import { join } from 'path';
import { readdir, readFile } from 'fs/promises';
import { getDb, DatabaseError } from './database';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { DB_CONFIG } from './config';
import { getAppDataPath } from '../../../../shared/paths';
import { logger } from '@/lib/logging/server';
import { findStaticDir } from '@/lib/utils/static';

interface Migration {
  version: string;
  name: string;
  sql: string;
}

async function getMigrations(): Promise<Migration[]> {
  const migrationsDir = findStaticDir('migrations');
  
  const files = await readdir(migrationsDir);
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

  return Promise.all(sqlFiles.map(async (file) => {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) {
      throw new Error(`Invalid migration filename format: ${file}`);
    }
    const [, version, name] = match;
    const sql = await readFile(join(migrationsDir, file), 'utf-8');
    return { version, name, sql };
  }));
}

async function ensureSchemaMigrationsTable() {
  const db = await getDb();
  const tableExists = (await db.queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
  ))?.count === 1;

  if (!tableExists) {
    await db.execute(`
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

async function getAppliedMigrations(): Promise<string[]> {
  const db = await getDb();
  await ensureSchemaMigrationsTable();
  const result = await db.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version');
  return result.rows.map(row => row.version);
}

export async function initializeDatabase(): Promise<boolean> {
  try {
    // Check if database exists
    const dbPath = DB_CONFIG.getPath();
    const dbExists = existsSync(dbPath);
    let isNewDatabase = false;
    if (!dbExists) {
      logger.debug('Database does not exist, creating new database...');
      // The database will be created automatically when we first connect to it
      // We just need to ensure the app data directory exists
      const appDataPath = getAppDataPath();
      if (!existsSync(appDataPath)) {
        await mkdir(appDataPath, { recursive: true });
      }
      isNewDatabase = true;
    }

    // Get all available migrations
    const migrations = await getMigrations();
    logger.debug('Found migrations:', migrations.map(m => `${m.version}: ${m.name}`));
    
    // Get already applied migrations
    const appliedVersions = await getAppliedMigrations();
    logger.debug('Already applied migrations:', appliedVersions);
    
    // Find migrations that need to be run
    const pendingMigrations = migrations.filter(m => !appliedVersions.includes(m.version));
    
    if (pendingMigrations.length === 0) {
      logger.debug('Database is up to date, no migrations needed');
      return isNewDatabase;
    }

    logger.debug(`Found ${pendingMigrations.length} pending migrations`);
    
    // Run each pending migration in a transaction
    const db = await getDb();
    for (const migration of pendingMigrations) {
      logger.debug(`Running migration ${migration.version}: ${migration.name}`);
      logger.debug('Migration SQL:', migration.sql);
      
      try {
        await db.transaction(async () => {
          logger.debug('Executing migration SQL...');
          await db.exec(migration.sql);
          
          // Record the migration
          logger.debug('Recording migration in schema_migrations...');
          await db.execute(
            'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
            [migration.version, migration.name]
          );
        });
        
        logger.debug(`Successfully applied migration ${migration.version}`);
      } catch (error) {
        logger.error(`Failed to apply migration ${migration.version}:`, error);
        throw error;
      }
    }
    
    // Run ANALYZE to optimize query performance
    logger.debug('Running ANALYZE to optimize query performance');
    await db.analyze();

    logger.debug('Database initialization completed successfully');
    return isNewDatabase;
  } catch (error) {
    logger.error('Database initialization error:', error);
    throw new DatabaseError('Failed to initialize database', error as Error);
  }
} 