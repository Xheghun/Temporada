import { DatabaseSync } from 'node:sqlite';
import { serializeDatabase } from '../../src/core/database/connection.ts';
import type {
  Database,
  SqlExecutor,
  SqlValue,
} from '../../src/core/database/connection.ts';
import { migrateDatabase } from '../../src/core/database/migrations/index.ts';

export async function openTestDatabase(path: string): Promise<Database> {
  const nativeDatabase = new DatabaseSync(path);
  const executor: SqlExecutor = {
    exec: async (sql) => {
      nativeDatabase.exec(sql);
    },
    run: async (sql, parameters = []) => ({
      changes: Number(nativeDatabase.prepare(sql).run(...parameters).changes),
    }),
    first: async <T,>(sql: string, parameters: readonly SqlValue[] = []) =>
      (nativeDatabase.prepare(sql).get(...parameters) as T | undefined) ?? null,
    all: async <T,>(sql: string, parameters: readonly SqlValue[] = []) =>
      nativeDatabase.prepare(sql).all(...parameters) as T[],
  };
  const database = serializeDatabase(executor, async () => {
    nativeDatabase.close();
  });
  try {
    await migrateDatabase(database);
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}
