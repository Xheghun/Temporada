import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { openTestDatabase } from './node-database.mts';
import { WorkerRepository } from '../../src/core/database/repositories/worker-repository.ts';
import { migrateDatabase } from '../../src/core/database/migrations/index.ts';
import { assignmentFixture } from '../../src/testing/persistence-fixtures.ts';
import type { DurableUpload } from '../../src/core/offline/domain/types.ts';

async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'mobile-persistence-'));
  const file = join(directory, 'worker.sqlite');
  let db = await openTestDatabase(file);
  const dependencies = { uuid: randomUUID, now: () => 100 };
  return {
    directory,
    file,
    get db() {
      return db;
    },
    worker: (id: string) => new WorkerRepository(db, id, dependencies),
    async reopen() {
      await db.close();
      db = await openTestDatabase(file);
    },
    image(workerId = 'ana'): DurableUpload {
      const name = join(directory, `${workerId}-passport.image`);
      const bytes = Buffer.from('fictional passport fixture');
      writeFileSync(name, bytes);
      return {
        workerId,
        uri: pathToFileURL(name).href,
        byteSize: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    },
    async close() {
      await db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('versioned migrations can be reapplied without erasing cached worker data', async () => {
  const f = await fixture();
  try {
    await f.worker('ana').cacheAssignment(assignmentFixture('ana'));
    await migrateDatabase(f.db);
    await f.reopen();
    assert.equal(
      (await f.db.first<{ user_version: number }>('PRAGMA user_version'))
        ?.user_version,
      2,
    );
    assert.equal(
      (await f.worker('ana').getAssignment())?.worker.displayName,
      'Ana López',
    );
    assert.deepEqual(await f.db.all('PRAGMA foreign_key_check'), []);
  } finally {
    await f.close();
  }
});

test('TEST-02: real close/reopen preserves both immutable actions, bytes and interrupted-send recovery', async () => {
  const f = await fixture();
  try {
    let ana = f.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    const image = f.image();
    const terms = await ana.enqueueTerms('v2');
    const document = await ana.enqueueDocument('passport', image);
    assert.equal(await ana.claimAction(terms.clientActionId, 100), true);
    const before = await ana.listActions();
    assert.equal(before.length, 2);
    await f.reopen();
    ana = f.worker('ana');
    assert.deepEqual(await ana.listActions(), before);
    assert.equal(await ana.recoverSending(), 1);
    assert.equal(await ana.recoverSending(), 0);
    const recovered = await ana.listActions();
    assert.equal(
      recovered.find((a) => a.clientActionId === terms.clientActionId)?.status,
      'queued',
    );
    for (const old of before) {
      const current = recovered.find((a) => a.id === old.id);
      assert(current);
      assert.deepEqual(current.payload, old.payload);
      assert.equal(current.fileUri, old.fileUri);
    }
    assert.equal(
      readFileSync(new URL(document.fileUri!), 'utf8'),
      'fictional passport fixture',
    );
    assert.equal(
      (await ana.getAssignment())?.terms.serverAcceptanceStatus,
      'not_confirmed',
    );
    assert.equal((await ana.listSubmissions())[0]?.serverStatus, null);
    assert.equal((await ana.listSubmissions())[0]?.deliveryStatus, 'queued');
  } finally {
    await f.close();
  }
});

test('worker scopes isolate cache, queues, claims and recovery across reopen and identity changes', async () => {
  const f = await fixture();
  try {
    const carla = f.worker('carla');
    const bruno = f.worker('bruno');
    await carla.cacheAssignment(assignmentFixture('carla'));
    await bruno.cacheAssignment(assignmentFixture('bruno'));
    const upload = await carla.enqueueDocument(
      'passport',
      f.image('carla'),
      'seed-carla-passport',
    );
    await carla.claimAction(upload.id, 100);
    assert.deepEqual(await bruno.listActions(), []);
    assert.deepEqual(await bruno.listSubmissions(), []);
    assert.equal(await bruno.claimAction(upload.id, 100), false);
    assert.equal(await bruno.recoverSending(), 0);
    await assert.rejects(
      bruno.cacheAssignment(assignmentFixture('carla')),
      /worker_mismatch/,
    );
    await assert.rejects(
      bruno.enqueueDocument('passport', f.image('carla')),
      /invalid_durable_upload/,
    );
    await f.reopen();
    assert.equal((await f.worker('carla').listActions())[0]?.status, 'sending');
    assert.equal(await f.worker('carla').recoverSending(), 1);
    assert.deepEqual(await f.worker('bruno').listActions(), []);
  } finally {
    await f.close();
  }
});

test('failed outbox insert rolls back business intent and an unrelated enqueue can proceed', async () => {
  const f = await fixture();
  try {
    const ana = f.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    await f.db.exec(
      "CREATE TRIGGER reject_upload BEFORE INSERT ON outbox_actions WHEN NEW.action_type='document_upload' BEGIN SELECT RAISE(ABORT,'test outbox failure'); END;",
    );
    await assert.rejects(
      ana.enqueueDocument('passport', f.image()),
      /test outbox failure/,
    );
    assert.deepEqual(await ana.listSubmissions(), []);
    assert.deepEqual(await ana.listActions(), []);
    assert.equal(
      (
        await f.db.first<{ pointer: string | null }>(
          "SELECT latest_local_action_id AS pointer FROM documents WHERE worker_id='ana' AND document_type='passport'",
        )
      )?.pointer,
      null,
    );
    assert.equal((await ana.enqueueTerms('v2')).status, 'queued');
  } finally {
    await f.close();
  }
});

test('late transaction failure rolls back an already inserted outbox row and submitted intent', async () => {
  const f = await fixture();
  try {
    const ana = f.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    await f.db.exec(
      "CREATE TRIGGER reject_pointer BEFORE UPDATE ON documents BEGIN SELECT RAISE(ABORT,'test projection failure'); END;",
    );
    await assert.rejects(
      ana.enqueueDocument('passport', f.image()),
      /test projection failure/,
    );
    assert.deepEqual(await ana.listActions(), []);
    assert.deepEqual(await ana.listSubmissions(), []);
    await f.db.exec(
      "CREATE TRIGGER reject_terms BEFORE INSERT ON terms_intents BEGIN SELECT RAISE(ABORT,'test terms failure'); END;",
    );
    await assert.rejects(ana.enqueueTerms('v2'), /test terms failure/);
    assert.deepEqual(await ana.listActions(), []);
  } finally {
    await f.close();
  }
});

test('new correction actions preserve historical review while stale snapshots cannot regress it', async () => {
  const f = await fixture();
  try {
    const carla = f.worker('carla');
    await carla.cacheAssignment(assignmentFixture('carla'));
    const a = await carla.enqueueDocument(
      'passport',
      f.image('carla'),
      'seed-carla-passport',
    );
    const b = await carla.enqueueDocument(
      'passport',
      f.image('carla'),
      'seed-carla-passport',
    );
    assert.notEqual(a.id, b.id);
    assert.equal(
      (await carla.listSubmissions())[0]?.correctionReason,
      'Foto borrosa, vuelva a tomarla',
    );
    const snapshot = assignmentFixture('carla');
    snapshot.serverRevision = 3;
    snapshot.documentSubmissions[0]!.serverRevision = 3;
    snapshot.documentSubmissions[0]!.status = 'approved';
    snapshot.documentSubmissions[0]!.correctionReason = null;
    await carla.cacheAssignment(snapshot);
    assert.equal(
      await carla.cacheAssignment(assignmentFixture('carla')),
      false,
    );
    assert.equal((await carla.listSubmissions())[0]?.serverStatus, 'approved');
    assert.equal((await carla.listActions()).length, 2);
    const latest = await f.db.first<{ id: string }>(
      'SELECT latest_local_action_id AS id FROM documents WHERE worker_id=? AND document_type=?',
      ['carla', 'passport'],
    );
    assert.equal(latest?.id, b.id);
    snapshot.documentSubmissions[0]!.status = 'correction_requested';
    await assert.rejects(
      carla.cacheAssignment(snapshot),
      /conflicting_review_revision/,
    );
  } finally {
    await f.close();
  }
});

test('immutable action metadata, ownership and relational references are enforced by SQLite', async () => {
  const f = await fixture();
  try {
    const ana = f.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    const a = await ana.enqueueTerms('v2');
    await assert.rejects(
      f.db.run('UPDATE outbox_actions SET payload_json=? WHERE id=?', [
        '{}',
        a.id,
      ]),
      /immutable_action/,
    );
    await f.worker('bruno').cacheAssignment(assignmentFixture('bruno'));
    await assert.rejects(
      f.db.run('INSERT INTO terms_intents VALUES(?,?,?,?)', [
        'bruno',
        a.id,
        'v2',
        100,
      ]),
    );
    assert.deepEqual(await f.db.all('PRAGMA foreign_key_check'), []);
  } finally {
    await f.close();
  }
});

test('only cached versions/catalog and measured durable worker-owned files can be enqueued', async () => {
  const f = await fixture();
  try {
    const ana = f.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    await assert.rejects(ana.enqueueTerms('v3'), /terms_not_cached/);
    await assert.rejects(
      ana.enqueueDocument('unknown', f.image()),
      /document_not_in_catalog/,
    );
    for (const file of [
      { ...f.image(), uri: 'file:///cache/image' },
      { ...f.image(), byteSize: 1_500_000 },
      { ...f.image(), sha256: 'bad' },
    ])
      await assert.rejects(
        ana.enqueueDocument('passport', file),
        /invalid_durable_upload/,
      );
    await assert.rejects(
      ana.enqueueDocument('passport', f.image(), 'another-worker-submission'),
      /replacement_not_owned/,
    );
    assert.deepEqual(await ana.listActions(), []);
  } finally {
    await f.close();
  }
});

test('concurrent claims are exclusive, and readers never see partial transactional writes', async () => {
  const f = await fixture();
  try {
    const ana = f.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    const action = await ana.enqueueTerms('v2');
    assert.deepEqual(
      await Promise.all([
        ana.claimAction(action.id, 100),
        ana.claimAction(action.id, 100),
      ]),
      [true, false],
    );
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let began: () => void = () => {};
    const started = new Promise<void>((r) => {
      began = r;
    });
    const writer = f.db.transaction(async (tx) => {
      await tx.run('UPDATE workers SET display_name=? WHERE worker_id=?', [
        'updated',
        'ana',
      ]);
      began();
      await gate;
      throw new Error('rollback');
    });
    const failure = assert.rejects(writer, /rollback/);
    await started;
    const reader = ana.getAssignment();
    release();
    await failure;
    assert.equal((await reader)?.worker.displayName, 'Ana López');
  } finally {
    await f.close();
  }
});

test('server creation order survives local clock skew and a newer decision on an older submission', async () => {
  const f = await fixture();
  try {
    const carla = f.worker('carla');
    await carla.cacheAssignment(assignmentFixture('carla'));
    const upload = await carla.enqueueDocument(
      'passport',
      f.image('carla'),
      'seed-carla-passport',
    );
    const snapshot = assignmentFixture('carla');
    snapshot.serverRevision = 2;
    snapshot.documentSubmissions.push({
      submissionId: 'new-server-passport',
      clientActionId: upload.id,
      documentType: 'passport',
      status: 'pending_review',
      correctionReason: null,
      serverRevision: 2,
      createdAt: 50,
    });
    await carla.cacheAssignment(snapshot);
    snapshot.serverRevision = 3;
    snapshot.documentSubmissions[0]!.serverRevision = 3;
    snapshot.documentSubmissions[0]!.status = 'approved';
    snapshot.documentSubmissions[0]!.correctionReason = null;
    await carla.cacheAssignment(snapshot);
    assert.equal(
      (
        await f.db.first<{ id: string }>(
          'SELECT latest_server_submission_id AS id FROM documents WHERE worker_id=? AND document_type=?',
          ['carla', 'passport'],
        )
      )?.id,
      'new-server-passport',
    );
    const local = (await carla.listSubmissions()).find(
      (s) => s.submissionId === upload.id,
    );
    assert.equal(local?.createdAt, 100);
    assert.equal(local?.serverCreatedAt, 50);
    assert.equal(local?.serverStatus, 'pending_review');
    assert.equal(local?.deliveryStatus, 'queued');
  } finally {
    await f.close();
  }
});

test('duplicate generated ID rejects atomically without replacing the earlier action', async () => {
  const f = await fixture();
  try {
    await f.worker('ana').cacheAssignment(assignmentFixture('ana'));
    const id = randomUUID();
    const repo = new WorkerRepository(f.db, 'ana', {
      uuid: () => id,
      now: () => 100,
    });
    const first = await repo.enqueueTerms('v2');
    await assert.rejects(repo.enqueueTerms('v2'));
    assert.deepEqual(await repo.listActions(), [first]);
  } finally {
    await f.close();
  }
});

test('future migration versions are rejected without silently downgrading the database', async () => {
  const f = await fixture();
  try {
    await f.db.exec('PRAGMA user_version=9');
    await assert.rejects(migrateDatabase(f.db), /unsupported_database_version/);
    assert.equal(
      (await f.db.first<{ user_version: number }>('PRAGMA user_version'))
        ?.user_version,
      9,
    );
  } finally {
    await f.close();
  }
});

test('enqueue sequence preserves intent order when clocks repeat or move backwards', async () => {
  const f = await fixture();
  try {
    await f.worker('ana').cacheAssignment(assignmentFixture('ana'));
    let now = 200;
    const repo = new WorkerRepository(f.db, 'ana', {
      uuid: randomUUID,
      now: () => now,
    });
    const a = await repo.enqueueTerms('v2');
    const b = await repo.enqueueTerms('v2');
    now = 50;
    const c = await repo.enqueueTerms('v2');
    assert.deepEqual(
      (await repo.listActions()).map((x) => x.id),
      [a.id, b.id, c.id],
    );
    await f.reopen();
    assert.deepEqual(
      (await f.worker('ana').eligibleActions(300)).map((x) => x.id),
      [a.id, b.id, c.id],
    );
  } finally {
    await f.close();
  }
});

test('catalog refresh retains known historical submissions and pending files without allowing new retired types', async () => {
  const f = await fixture();
  try {
    const carla = f.worker('carla');
    await carla.cacheAssignment(assignmentFixture('carla'));
    const action = await carla.enqueueDocument(
      'passport',
      f.image('carla'),
      'seed-carla-passport',
    );
    const next = assignmentFixture('carla');
    next.serverRevision = 2;
    next.requiredDocuments = next.requiredDocuments.filter(
      (d) => d.documentType !== 'passport',
    );
    await carla.cacheAssignment(next);
    assert.equal((await carla.listActions())[0]?.fileUri, action.fileUri);
    assert.equal((await carla.listSubmissions()).length, 2);
    assert.equal(
      (await carla.getAssignment())?.requiredDocuments.some(
        (d) => d.documentType === 'passport',
      ),
      false,
    );
    await assert.rejects(
      carla.enqueueDocument('passport', f.image('carla')),
      /document_not_in_catalog/,
    );
  } finally {
    await f.close();
  }
});

test('cached newer terms never substitute the exact version passed to confirmation', async () => {
  const f = await fixture();
  try {
    const ana = f.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    const next = assignmentFixture('ana');
    next.serverRevision = 2;
    next.terms.termsVersionId = 'v3';
    await ana.cacheAssignment(next);
    const old = await ana.enqueueTerms('v2');
    assert.equal(
      old.payload.kind === 'terms_acceptance' && old.payload.termsVersionId,
      'v2',
    );
    assert.equal((await ana.getAssignment())?.terms.termsVersionId, 'v3');
    assert.equal(
      (await ana.getAssignment())?.terms.serverAcceptanceStatus,
      'not_confirmed',
    );
  } finally {
    await f.close();
  }
});

test('native probe accepts repeated recovery after reopen but rejects changed intent or retry metadata', async () => {
  const { assertRecoverySnapshot } =
    await import('../../src/testing/recovery-snapshot.ts');
  const f = await fixture();
  try {
    const worker = f.worker('ana');
    await worker.cacheAssignment(assignmentFixture('ana'));
    const action = await worker.enqueueTerms('v2');
    await worker.claimAction(action.id, 100);
    const expected = await worker.listActions();
    await f.reopen();
    assert.equal(
      assertRecoverySnapshot(expected, await f.worker('ana').listActions()),
      1,
    );
    await f.worker('ana').recoverSending();
    await f.reopen();
    const recovered = await f.worker('ana').listActions();
    assert.equal(assertRecoverySnapshot(expected, recovered), 0);
    assert.equal(assertRecoverySnapshot(expected, recovered), 0);
    const first = recovered[0];
    assert.ok(first);
    for (const mutation of [
      { ...first, clientActionId: randomUUID() },
      {
        ...first,
        payload: { ...first.payload, termsVersionId: 'v3' },
      },
      { ...first, fileUri: 'file:///changed' },
      { ...first, attemptCount: 8 },
      { ...first, status: 'delivered' as const },
    ])
      assert.throws(
        () => assertRecoverySnapshot(expected, [mutation]),
        /actions_changed/,
      );
    assert.throws(
      () => assertRecoverySnapshot(expected, []),
      /actions_changed/,
    );
  } finally {
    await f.close();
  }
});

test('persisted action JSON is validated before listing or dispatch eligibility without deleting intent', async () => {
  const f = await fixture();
  try {
    const worker = f.worker('ana');
    await worker.cacheAssignment(assignmentFixture('ana'));
    const id = randomUUID();
    const valid = {
      kind: 'terms_acceptance',
      workerId: 'ana',
      clientActionId: id,
      termsVersionId: 'v2',
    };
    const invalid = [
      '{broken',
      'null',
      '[]',
      JSON.stringify({ ...valid, termsVersionId: 2 }),
      JSON.stringify({ ...valid, termsVersionId: ' ' }),
      JSON.stringify({ ...valid, kind: 'unknown' }),
      JSON.stringify({ ...valid, workerId: 'carla' }),
      JSON.stringify({ ...valid, clientActionId: randomUUID() }),
      JSON.stringify({
        ...valid,
        kind: 'document_upload',
        documentType: 'passport',
        localSubmissionId: id,
        sha256: 'not-a-digest',
        replacesSubmissionId: null,
      }),
    ];
    for (const json of invalid) {
      await f.db.run(
        `INSERT INTO outbox_actions
        (id,worker_id,client_action_id,action_type,payload_json,status,next_attempt_at,created_at,updated_at)
        VALUES (?,?,?,?,?,'queued',0,100,100)`,
        [
          id,
          'ana',
          id,
          json.includes('document_upload')
            ? 'document_upload'
            : 'terms_acceptance',
          json,
        ],
      );
      await assert.rejects(
        worker.listActions(),
        /invalid_persisted|identity_mismatch/,
      );
      await assert.rejects(
        worker.eligibleActions(100),
        /invalid_persisted|identity_mismatch/,
      );
      assert.equal(
        (
          await f.db.first<{ count: number }>(
            'SELECT COUNT(*) AS count FROM outbox_actions WHERE worker_id=?',
            ['ana'],
          )
        )?.count,
        1,
      );
      await f.db.run(
        'DELETE FROM outbox_actions WHERE worker_id=? AND client_action_id=?',
        ['ana', id],
      );
    }
    const terms = await worker.enqueueTerms('v2');
    const upload = await worker.enqueueDocument('passport', f.image());
    await f.reopen();
    assert.deepEqual(
      (await f.worker('ana').listActions()).map((a) => a.payload),
      [terms.payload, upload.payload],
    );
  } finally {
    await f.close();
  }
});

test('persisted localized summaries and catalog labels reject malformed shapes', async () => {
  const f = await fixture();
  try {
    const worker = f.worker('ana');
    await worker.cacheAssignment(assignmentFixture('ana'));
    for (const json of [
      '{broken',
      'null',
      '[]',
      '{}',
      '{"es":"texto","en":3}',
      '{"es":" ","en":"text"}',
    ]) {
      await f.db.run('UPDATE terms SET content_json=? WHERE worker_id=?', [
        json,
        'ana',
      ]);
      await assert.rejects(worker.getAssignment(), /invalid_persisted/);
    }
    await worker.cacheAssignment(assignmentFixture('ana'));
    await f.db.run(
      'UPDATE document_catalog SET content_json=? WHERE worker_id=? AND document_type=?',
      ['{"es":"texto"}', 'ana', 'passport'],
    );
    await assert.rejects(
      worker.getAssignment(),
      /invalid_persisted_localized_text/,
    );
  } finally {
    await f.close();
  }
});
