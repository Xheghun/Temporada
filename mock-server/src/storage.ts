import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { workers } from './seed.ts';

export interface Worker {
  workerId: string;
  displayName: string;
  phoneNumber: string;
}
export interface Submission {
  submissionId: string;
  workerId: string;
  clientActionId: string;
  documentType: string;
  status: string;
  correctionReason: string | null;
  serverRevision: number;
  fileName: string | null;
  createdAt: number;
  replacesSubmissionId: string | null;
}
export interface Receipt {
  fingerprint: string;
  responseJson: string;
}

export class Store {
  readonly db: DatabaseSync;
  readonly uploads: string;

  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.uploads = join(directory, 'uploads');
    mkdirSync(this.uploads, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(directory, 'state.sqlite'));
    this.db.exec(
      'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA locking_mode=EXCLUSIVE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;',
    );
    this.transaction(() => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), termsVersion TEXT NOT NULL, revision INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS workers (workerId TEXT PRIMARY KEY, displayName TEXT NOT NULL, phoneNumber TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (tokenHash TEXT PRIMARY KEY, phoneNumber TEXT NOT NULL, expiresAt INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS acceptances (acceptanceId TEXT PRIMARY KEY, workerId TEXT NOT NULL REFERENCES workers, clientActionId TEXT NOT NULL, termsVersionId TEXT NOT NULL, UNIQUE(workerId,clientActionId));
        CREATE TABLE IF NOT EXISTS submissions (submissionId TEXT PRIMARY KEY, workerId TEXT NOT NULL REFERENCES workers, clientActionId TEXT NOT NULL, documentType TEXT NOT NULL, status TEXT NOT NULL, correctionReason TEXT, serverRevision INTEGER NOT NULL, fileName TEXT, createdAt INTEGER NOT NULL, replacesSubmissionId TEXT, UNIQUE(workerId,clientActionId));
        CREATE TABLE IF NOT EXISTS receipts (workerId TEXT NOT NULL REFERENCES workers, clientActionId TEXT NOT NULL, fingerprint TEXT NOT NULL, responseJson TEXT NOT NULL, PRIMARY KEY(workerId,clientActionId));
        CREATE INDEX IF NOT EXISTS submissions_worker ON submissions(workerId,createdAt,submissionId);
        INSERT OR IGNORE INTO settings VALUES(1,'v2',1);
        PRAGMA user_version=1;
      `);
      for (const w of workers)
        this.db
          .prepare('INSERT OR IGNORE INTO workers VALUES(?,?,?)')
          .run(w.workerId, w.displayName, w.phoneNumber);
      this.db
        .prepare('INSERT OR IGNORE INTO acceptances VALUES(?,?,?,?)')
        .run('seed-bruno-v2', 'bruno', 'seed-bruno-v2', 'v2');
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO submissions VALUES(?,?,?,?,?,?,?,?,?,?)',
      );
      insert.run(
        'seed-bruno-passport',
        'bruno',
        'seed-bruno-passport',
        'passport',
        'approved',
        null,
        1,
        null,
        1,
        null,
      );
      insert.run(
        'seed-carla-passport',
        'carla',
        'seed-carla-passport',
        'passport',
        'correction_requested',
        'Foto borrosa, vuelva a tomarla',
        1,
        null,
        1,
        null,
      );
    });
    // Only one server process owns this directory. Startup runs before accepting requests.
    // A crash between file creation and DB commit leaves an unreferenced app-owned file.
    const referenced = new Set(
      (
        this.db
          .prepare(
            'SELECT fileName FROM submissions WHERE fileName IS NOT NULL',
          )
          .all() as unknown as { fileName: string }[]
      ).map((row) => row.fileName),
    );
    for (const name of readdirSync(this.uploads))
      if (!referenced.has(name)) unlinkSync(join(this.uploads, name));
    for (const name of referenced)
      if (!existsSync(join(this.uploads, name))) {
        this.db.close();
        throw new Error(
          'A committed mock upload is missing; restore storage before serving',
        );
      }
  }

  transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  revision(): number {
    return (
      this.db
        .prepare(
          'UPDATE settings SET revision=revision+1 WHERE id=1 RETURNING revision',
        )
        .get() as unknown as { revision: number }
    ).revision;
  }
  settings(): { termsVersion: string; revision: number } {
    return this.db
      .prepare('SELECT termsVersion,revision FROM settings WHERE id=1')
      .get() as unknown as { termsVersion: string; revision: number };
  }
  worker(id: string): Worker | undefined {
    return this.db
      .prepare('SELECT * FROM workers WHERE workerId=?')
      .get(id) as unknown as Worker | undefined;
  }
  phoneWorkers(phone: string): Worker[] {
    return this.db
      .prepare('SELECT * FROM workers WHERE phoneNumber=? ORDER BY workerId')
      .all(phone) as unknown as Worker[];
  }
  submissions(workerId: string): Submission[] {
    return this.db
      .prepare(
        'SELECT * FROM submissions WHERE workerId=? ORDER BY createdAt,submissionId',
      )
      .all(workerId) as unknown as Submission[];
  }
  receipt(workerId: string, actionId: string): Receipt | undefined {
    return this.db
      .prepare(
        'SELECT fingerprint,responseJson FROM receipts WHERE workerId=? AND clientActionId=?',
      )
      .get(workerId, actionId) as unknown as Receipt | undefined;
  }
  close(): void {
    this.db.close();
  }
}
