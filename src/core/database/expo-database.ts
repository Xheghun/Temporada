import { openDatabaseAsync } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { serializeDatabase } from './connection.ts';
import type { Database, SqlExecutor } from './connection.ts';
import { migrateDatabase } from './migrations/index.ts';
import { WorkerRepository } from './repositories/worker-repository.ts';

export async function openWorkerDatabase(
  name = 'worker-cache.sqlite',
): Promise<Database> {
  // A private, non-shared handle keeps all transaction statements and reads inside our queue.
  const native = await openDatabaseAsync(name, { useNewConnection: true });
  const executor: SqlExecutor = {
    exec: (sql) => native.execAsync(sql),
    run: async (sql, params = []) => {
      const result = await native.runAsync(sql, [...params]);
      return { changes: result.changes };
    },
    first: <T>(sql: string, params = []) =>
      native.getFirstAsync<T>(sql, params),
    all: <T>(sql: string, params = []) => native.getAllAsync<T>(sql, params),
  };
  const db = serializeDatabase(executor, () => native.closeAsync());
  try {
    await migrateDatabase(db);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
export function workerRepository(
  db: Database,
  workerId: string,
): WorkerRepository {
  return new WorkerRepository(db, workerId, {
    uuid: randomUUID,
    now: Date.now,
  });
}
