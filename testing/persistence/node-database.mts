import { DatabaseSync } from 'node:sqlite';
import { serializeDatabase } from '../../src/core/database/connection.ts';
import type {
  Database,
  SqlExecutor,
  SqlValue,
} from '../../src/core/database/connection.ts';
import { migrateDatabase } from '../../src/core/database/migrations/index.ts';

export async function openTestDatabase(path: string): Promise<Database> {
  const native = new DatabaseSync(path);
  const executor: SqlExecutor = {
    exec: async (sql) => {
      native.exec(sql);
    },
    run: async (sql, params = []) => ({
      changes: Number(native.prepare(sql).run(...params).changes),
    }),
    first: async <T,>(sql: string, params: readonly SqlValue[] = []) =>
      (native.prepare(sql).get(...params) as T | undefined) ?? null,
    all: async <T,>(sql: string, params: readonly SqlValue[] = []) =>
      native.prepare(sql).all(...params) as T[],
  };
  const db = serializeDatabase(executor, async () => {
    native.close();
  });
  try {
    await migrateDatabase(db);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
