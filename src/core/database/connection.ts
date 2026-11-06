export type SqlValue = string | number | null;
export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  run(
    sql: string,
    parameters?: readonly SqlValue[],
  ): Promise<{ changes: number }>;
  first<T>(sql: string, parameters?: readonly SqlValue[]): Promise<T | null>;
  all<T>(sql: string, parameters?: readonly SqlValue[]): Promise<T[]>;
}
export interface Database extends SqlExecutor {
  transaction<T>(
    operation: (transaction: SqlExecutor) => Promise<T>,
  ): Promise<T>;
  close(): Promise<void>;
}

/** Own the native handle privately. Serialize reads too: no observer sees half an enqueue. */
export function serializeDatabase(
  executor: SqlExecutor,
  close: () => Promise<void>,
): Database {
  let tail: Promise<unknown> = Promise.resolve();
  let closed = false;
  const schedule = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(() => {
      if (closed) throw new Error('database_closed');
      return operation();
    });
    // Preserve failure for its caller without poisoning later queued operations.
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  return {
    exec: (sql) => schedule(() => executor.exec(sql)),
    run: (sql, parameters) => schedule(() => executor.run(sql, parameters)),
    first: <T>(sql: string, parameters?: readonly SqlValue[]) =>
      schedule(() => executor.first<T>(sql, parameters)),
    all: <T>(sql: string, parameters?: readonly SqlValue[]) =>
      schedule(() => executor.all<T>(sql, parameters)),
    transaction: <T>(operation: (transaction: SqlExecutor) => Promise<T>) =>
      schedule(async () => {
        await executor.exec('BEGIN IMMEDIATE');
        try {
          const result = await operation(executor);
          await executor.exec('COMMIT');
          return result;
        } catch (error) {
          try {
            await executor.exec('ROLLBACK');
          } catch (rollbackError) {
            throw new AggregateError(
              [error, rollbackError],
              'transaction_failed',
            );
          }
          throw error;
        }
      }),
    close: () =>
      schedule(async () => {
        await close();
        closed = true;
      }),
  };
}
