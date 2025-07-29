import { Database } from 'sqlite';
import { open } from 'sqlite';
import { DB_CONFIG } from './config';

export type SqliteValue = string | number | boolean | null | Buffer;
export type SqliteParams = Record<string, SqliteValue> | SqliteValue[];

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class DatabaseClient {
  private db: Database;

  private constructor(db: Database) {
    this.db = db;
  }

  static async create(databasePath: string): Promise<DatabaseClient> {
    try {
      const db = await open({
        filename: databasePath,
        driver: require('sqlite3').Database
      });
      
      // Enable foreign keys
      await db.run('PRAGMA foreign_keys = ON');
      
      return new DatabaseClient(db);
    } catch (error) {
      throw new DatabaseError('Failed to initialize database', error as Error);
    }
  }

  /**
   * Execute a query that returns rows
   */
  async query<T = Record<string, SqliteValue>>(
    sql: string,
    params: SqliteParams = {}
  ): Promise<QueryResult<T>> {
    try {
      const rows = await this.db.all<T[]>(sql, params);
      return {
        rows: rows || [],
        rowCount: rows?.length || 0,
      };
    } catch (error) {
      throw new DatabaseError(`Query failed: ${sql}`, error as Error);
    }
  }

  /**
   * Execute a query that returns a single row
   */
  async queryOne<T = Record<string, SqliteValue>>(
    sql: string,
    params: SqliteParams = {}
  ): Promise<T | null> {
    try {
      const row = await this.db.get<T>(sql, params);
      return row || null;
    } catch (error) {
      throw new DatabaseError(`Query failed: ${sql}`, error as Error);
    }
  }

  /**
   * Execute a query that doesn't return rows
   */
  async execute(sql: string, params: SqliteParams = {}): Promise<{ changes: number }> {
    try {
      const result = await this.db.run(sql, params);
      return { changes: result.changes || 0 };
    } catch (error) {
      throw new DatabaseError(`Execute failed: ${sql}`, error as Error);
    }
  }

  /**
   * Execute multiple statements in a transaction
   */
  async transaction<T>(callback: (db: DatabaseClient) => Promise<T>): Promise<T> {
    try {
      await this.db.run('BEGIN TRANSACTION');
      try {
        const result = await callback(this);
        await this.db.run('COMMIT');
        return result;
      } catch (error) {
        await this.db.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new DatabaseError('Transaction failed', error as Error);
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    try {
      await this.db.close();
    } catch (error) {
      throw new DatabaseError('Failed to close database', error as Error);
    }
  }

  /**
   * Run ANALYZE to optimize query performance
   */
  async analyze(): Promise<void> {
    try {
      await this.db.run('ANALYZE');
    } catch (error) {
      throw new DatabaseError('Failed to analyze database', error as Error);
    }
  }

  /**
   * Execute multiple SQL statements
   */
  async exec(sql: string): Promise<void> {
    try {
      await this.db.exec(sql);
    } catch (error) {
      throw new DatabaseError(`Execute failed: ${sql}`, error as Error);
    }
  }
}

// Create a singleton instance
let dbInstance: DatabaseClient | null = null;

export async function getDb(): Promise<DatabaseClient> {
  if (!dbInstance) {
    dbInstance = await DatabaseClient.create(DB_CONFIG.getPath());
  }
  return dbInstance;
} 