import { File, Paths } from 'expo-file-system';
import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';
import {
  openWorkerDatabase,
  workerRepository,
} from '../core/database/expo-database.ts';
import { assertRecoverySnapshot } from './recovery-snapshot.ts';
import { assignmentFixture } from './persistence-fixtures.ts';
import type { OutboxAction } from '../core/offline/domain/types.ts';

const proofName = 'persistence-proof.sqlite';
const fixtureBytes = 'fictional passport fixture';
// SHA-256 of the exact fixture bytes, not real worker data.
const fixtureDigest =
  '316eac4499fedc5262031fa6d23b965f48788f49aad751257789aea9996fd75d';

/** Explicit developer-only probe; never initializes or clears the actual worker database. */
export async function runNativePersistenceCheck(mode: string): Promise<string> {
  if (!__DEV__) throw new Error('developer_probe_disabled');
  if (mode === 'reset') {
    // Open/close ensures the proof file exists without interpreting native paths as URIs.
    const proof = await openDatabaseAsync(proofName, {
      useNewConnection: true,
    });
    await proof.closeAsync();
    await deleteDatabaseAsync(proofName);
    const fixture = new File(
      Paths.document,
      'persistence-proof-passport.image',
    );
    if (fixture.exists) fixture.delete();
    return 'RESET_PASSED: only the dedicated proof database and fixture were removed.';
  }
  const db = await openWorkerDatabase(proofName);
  try {
    const carla = workerRepository(db, 'carla');
    const bruno = workerRepository(db, 'bruno');
    const file = new File(Paths.document, 'persistence-proof-passport.image');
    if (mode === 'seed') {
      if ((await carla.listActions()).length)
        throw new Error('proof_already_seeded_use_verify');
      await carla.cacheAssignment(assignmentFixture('carla'));
      await bruno.cacheAssignment(assignmentFixture('bruno'));
      if (!file.exists) file.create();
      await file.write(fixtureBytes);
      const terms = await carla.enqueueTerms('v2');
      await carla.enqueueDocument(
        'passport',
        {
          workerId: 'carla',
          uri: file.uri,
          byteSize: file.size,
          sha256: fixtureDigest,
        },
        'seed-carla-passport',
      );
      if (!(await carla.claimAction(terms.id, Date.now())))
        throw new Error('claim_failed');
      const expected = await carla.listActions();
      await db.exec(
        'CREATE TABLE IF NOT EXISTS probe_expected(value TEXT NOT NULL)',
      );
      await db.run('INSERT INTO probe_expected VALUES(?)', [
        JSON.stringify(expected),
      ]);
      if ((await bruno.listActions()).length) throw new Error('worker_leak');
      return 'SEED_PASSED: 2 durable Carla actions, one sending; Bruno queue empty. Force-stop Expo Go, relaunch with mode=verify.';
    }
    if (mode !== 'verify') throw new Error('mode_must_be_seed_or_verify');
    const record = await db.first<{ value: string }>(
      'SELECT value FROM probe_expected LIMIT 1',
    );
    if (!record) throw new Error('proof_not_seeded');
    const expected = JSON.parse(record.value) as OutboxAction[];
    const sending = assertRecoverySnapshot(expected, await carla.listActions());
    if ((await carla.recoverSending()) !== sending)
      throw new Error('interrupted_action_not_recovered');
    const actual = await carla.listActions();
    for (const old of expected) {
      const current = actual.find((a) => a.id === old.id);
      if (
        !current ||
        current.status !== 'queued' ||
        current.fileUri !== old.fileUri ||
        JSON.stringify(current.payload) !== JSON.stringify(old.payload)
      )
        throw new Error('intent_lost');
    }
    if (file.textSync() !== fixtureBytes || (await bruno.listActions()).length)
      throw new Error('file_or_worker_isolation_failed');
    if (
      (await carla.listSubmissions()).filter(
        (s) => s.serverStatus === 'correction_requested',
      ).length !== 1
    )
      throw new Error('history_lost');
    return 'RECOVERY_PASSED: same 2 action IDs/payloads/file after process death; sending recovered; correction history retained; Bruno queue empty.';
  } finally {
    await db.close();
  }
}
