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
  const nativeDatabase = await openDatabaseAsync(name, {
    useNewConnection: true,
  });
  const executor: SqlExecutor = {
    exec: (sql) => nativeDatabase.execAsync(sql),
    run: async (sql, parameters = []) => {
      const result = await nativeDatabase.runAsync(sql, [...parameters]);
      return { changes: result.changes };
    },
    first: <T>(sql: string, parameters = []) =>
      nativeDatabase.getFirstAsync<T>(sql, parameters),
    all: <T>(sql: string, parameters = []) =>
      nativeDatabase.getAllAsync<T>(sql, parameters),
  };
  const database = serializeDatabase(executor, () =>
    nativeDatabase.closeAsync(),
  );
  try {
    await migrateDatabase(database);
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}
export function workerRepository(
  database: Database,
  workerId: string,
): WorkerRepository {
  return new WorkerRepository(database, workerId, {
    uuid: randomUUID,
    now: Date.now,
  });
}
