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
  let database = await openTestDatabase(file);
  const dependencies = { uuid: randomUUID, now: () => 100 };
  return {
    directory,
    file,
    get database() {
      return database;
    },
    worker: (workerId: string) =>
      new WorkerRepository(database, workerId, dependencies),
    async reopen() {
      await database.close();
      database = await openTestDatabase(file);
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
      await database.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('versioned migrations can be reapplied without erasing cached worker data', async () => {
  const testContext = await fixture();
  try {
    await testContext.worker('ana').cacheAssignment(assignmentFixture('ana'));
    await migrateDatabase(testContext.database);
    await testContext.reopen();
    assert.equal(
      (
        await testContext.database.first<{ user_version: number }>(
          'PRAGMA user_version',
        )
      )?.user_version,
      3,
    );
    assert.equal(
      (await testContext.worker('ana').getAssignment())?.worker.displayName,
      'Ana López',
    );
    assert.deepEqual(
      await testContext.database.all('PRAGMA foreign_key_check'),
      [],
    );
  } finally {
    await testContext.close();
  }
});

test('TEST-02: real close/reopen preserves both immutable actions, bytes and interrupted-send recovery', async () => {
  const testContext = await fixture();
  try {
    let ana = testContext.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    const image = testContext.image();
    const terms = await ana.enqueueTerms('v2');
    const document = await ana.enqueueDocument('passport', image);
    assert.equal(await ana.claimAction(terms.clientActionId, 100), true);
    const before = await ana.listActions();
    assert.equal(before.length, 2);
    await testContext.reopen();
    ana = testContext.worker('ana');
    assert.deepEqual(await ana.listActions(), before);
    assert.equal(await ana.recoverSending(), 1);
    assert.equal(await ana.recoverSending(), 0);
    const recovered = await ana.listActions();
    assert.equal(
      recovered.find((action) => action.clientActionId === terms.clientActionId)
        ?.status,
      'queued',
    );
    for (const previousAction of before) {
      const current = recovered.find(
        (action) => action.id === previousAction.id,
      );
      assert(current);
      assert.deepEqual(current.payload, previousAction.payload);
      assert.equal(current.fileUri, previousAction.fileUri);
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
    await testContext.close();
  }
});

test('worker scopes isolate cache, queues, claims and recovery across reopen and identity changes', async () => {
  const testContext = await fixture();
  try {
    const carla = testContext.worker('carla');
    const bruno = testContext.worker('bruno');
    await carla.cacheAssignment(assignmentFixture('carla'));
    await bruno.cacheAssignment(assignmentFixture('bruno'));
    const upload = await carla.enqueueDocument(
      'passport',
      testContext.image('carla'),
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
      bruno.enqueueDocument('passport', testContext.image('carla')),
      /invalid_durable_upload/,
    );
    await testContext.reopen();
    assert.equal(
      (await testContext.worker('carla').listActions())[0]?.status,
      'sending',
    );
    assert.equal(await testContext.worker('carla').recoverSending(), 1);
    assert.deepEqual(await testContext.worker('bruno').listActions(), []);
  } finally {
    await testContext.close();
  }
});

test('failed outbox insert rolls back business intent and an unrelated enqueue can proceed', async () => {
  const testContext = await fixture();
  try {
    const ana = testContext.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    await testContext.database.exec(
      "CREATE TRIGGER reject_upload BEFORE INSERT ON outbox_actions WHEN NEW.action_type='document_upload' BEGIN SELECT RAISE(ABORT,'test outbox failure'); END;",
    );
    await assert.rejects(
      ana.enqueueDocument('passport', testContext.image()),
      /test outbox failure/,
    );
    assert.deepEqual(await ana.listSubmissions(), []);
    assert.deepEqual(await ana.listActions(), []);
    assert.equal(
      (
        await testContext.database.first<{ pointer: string | null }>(
          "SELECT latest_local_action_id AS pointer FROM documents WHERE worker_id='ana' AND document_type='passport'",
        )
      )?.pointer,
      null,
    );
    assert.equal((await ana.enqueueTerms('v2')).status, 'queued');
  } finally {
    await testContext.close();
  }
});

test('late transaction failure rolls back an already inserted outbox row and submitted intent', async () => {
  const testContext = await fixture();
  try {
    const ana = testContext.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    await testContext.database.exec(
      "CREATE TRIGGER reject_pointer BEFORE UPDATE ON documents BEGIN SELECT RAISE(ABORT,'test projection failure'); END;",
    );
    await assert.rejects(
      ana.enqueueDocument('passport', testContext.image()),
      /test projection failure/,
    );
    assert.deepEqual(await ana.listActions(), []);
    assert.deepEqual(await ana.listSubmissions(), []);
    await testContext.database.exec(
      "CREATE TRIGGER reject_terms BEFORE INSERT ON terms_intents BEGIN SELECT RAISE(ABORT,'test terms failure'); END;",
    );
    await assert.rejects(ana.enqueueTerms('v2'), /test terms failure/);
    assert.deepEqual(await ana.listActions(), []);
  } finally {
    await testContext.close();
  }
});

test('new correction actions preserve historical review while stale snapshots cannot regress it', async () => {
  const testContext = await fixture();
  try {
    const carla = testContext.worker('carla');
    await carla.cacheAssignment(assignmentFixture('carla'));
    const firstAction = await carla.enqueueDocument(
      'passport',
      testContext.image('carla'),
      'seed-carla-passport',
    );
    const secondAction = await carla.enqueueDocument(
      'passport',
      testContext.image('carla'),
      'seed-carla-passport',
    );
    assert.notEqual(firstAction.id, secondAction.id);
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
    const latest = await testContext.database.first<{ id: string }>(
      'SELECT latest_local_action_id AS id FROM documents WHERE worker_id=? AND document_type=?',
      ['carla', 'passport'],
    );
    assert.equal(latest?.id, secondAction.id);
    snapshot.documentSubmissions[0]!.status = 'correction_requested';
    await assert.rejects(
      carla.cacheAssignment(snapshot),
      /conflicting_review_revision/,
    );
  } finally {
    await testContext.close();
  }
});

test('immutable action metadata, ownership and relational references are enforced by SQLite', async () => {
  const testContext = await fixture();
  try {
    const ana = testContext.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    const firstAction = await ana.enqueueTerms('v2');
    await assert.rejects(
      testContext.database.run(
        'UPDATE outbox_actions SET payload_json=? WHERE id=?',
        ['{}', firstAction.id],
      ),
      /immutable_action/,
    );
    await testContext
      .worker('bruno')
      .cacheAssignment(assignmentFixture('bruno'));
    await assert.rejects(
      testContext.database.run('INSERT INTO terms_intents VALUES(?,?,?,?)', [
        'bruno',
        firstAction.id,
        'v2',
        100,
      ]),
    );
    assert.deepEqual(
      await testContext.database.all('PRAGMA foreign_key_check'),
      [],
    );
  } finally {
    await testContext.close();
  }
});

test('only cached versions/catalog and measured durable worker-owned files can be enqueued', async () => {
  const testContext = await fixture();
  try {
    const ana = testContext.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    await assert.rejects(ana.enqueueTerms('v3'), /terms_not_cached/);
    await assert.rejects(
      ana.enqueueDocument('unknown', testContext.image()),
      /document_not_in_catalog/,
    );
    for (const file of [
      { ...testContext.image(), uri: 'file:///cache/image' },
      { ...testContext.image(), byteSize: 1_500_000 },
      { ...testContext.image(), sha256: 'bad' },
    ])
      await assert.rejects(
        ana.enqueueDocument('passport', file),
        /invalid_durable_upload/,
      );
    await assert.rejects(
      ana.enqueueDocument(
        'passport',
        testContext.image(),
        'another-worker-submission',
      ),
      /replacement_not_owned/,
    );
    assert.deepEqual(await ana.listActions(), []);
  } finally {
    await testContext.close();
  }
});

test('concurrent claims are exclusive, and readers never see partial transactional writes', async () => {
  const testContext = await fixture();
  try {
    const ana = testContext.worker('ana');
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
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let began: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      began = resolve;
    });
    const writer = testContext.database.transaction(async (transaction) => {
      await transaction.run(
        'UPDATE workers SET display_name=? WHERE worker_id=?',
        ['updated', 'ana'],
      );
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
    await testContext.close();
  }
});

test('server creation order survives local clock skew and a newer decision on an older submission', async () => {
  const testContext = await fixture();
  try {
    const carla = testContext.worker('carla');
    await carla.cacheAssignment(assignmentFixture('carla'));
    const upload = await carla.enqueueDocument(
      'passport',
      testContext.image('carla'),
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
        await testContext.database.first<{ id: string }>(
          'SELECT latest_server_submission_id AS id FROM documents WHERE worker_id=? AND document_type=?',
          ['carla', 'passport'],
        )
      )?.id,
      'new-server-passport',
    );
    const local = (await carla.listSubmissions()).find(
      (submission) => submission.submissionId === upload.id,
    );
    assert.equal(local?.createdAt, 100);
    assert.equal(local?.serverCreatedAt, 50);
    assert.equal(local?.serverStatus, 'pending_review');
    assert.equal(local?.deliveryStatus, 'queued');
  } finally {
    await testContext.close();
  }
});

test('duplicate generated ID rejects atomically without replacing the earlier action', async () => {
  const testContext = await fixture();
  try {
    await testContext.worker('ana').cacheAssignment(assignmentFixture('ana'));
    const actionId = randomUUID();
    const repo = new WorkerRepository(testContext.database, 'ana', {
      uuid: () => actionId,
      now: () => 100,
    });
    const first = await repo.enqueueTerms('v2');
    await assert.rejects(repo.enqueueTerms('v2'));
    assert.deepEqual(await repo.listActions(), [first]);
  } finally {
    await testContext.close();
  }
});

test('future migration versions are rejected without silently downgrading the database', async () => {
  const testContext = await fixture();
  try {
    await testContext.database.exec('PRAGMA user_version=9');
    await assert.rejects(
      migrateDatabase(testContext.database),
      /unsupported_database_version/,
    );
    assert.equal(
      (
        await testContext.database.first<{ user_version: number }>(
          'PRAGMA user_version',
        )
      )?.user_version,
      9,
    );
  } finally {
    await testContext.close();
  }
});

test('enqueue sequence preserves intent order when clocks repeat or move backwards', async () => {
  const testContext = await fixture();
  try {
    await testContext.worker('ana').cacheAssignment(assignmentFixture('ana'));
    let now = 200;
    const repo = new WorkerRepository(testContext.database, 'ana', {
      uuid: randomUUID,
      now: () => now,
    });
    const firstAction = await repo.enqueueTerms('v2');
    const secondAction = await repo.enqueueTerms('v2');
    now = 50;
    const thirdAction = await repo.enqueueTerms('v2');
    assert.deepEqual(
      (await repo.listActions()).map((action) => action.id),
      [firstAction.id, secondAction.id, thirdAction.id],
    );
    await testContext.reopen();
    assert.deepEqual(
      (await testContext.worker('ana').eligibleActions(300)).map(
        (action) => action.id,
      ),
      [firstAction.id, secondAction.id, thirdAction.id],
    );
  } finally {
    await testContext.close();
  }
});

test('catalog refresh retains known historical submissions and pending files without allowing new retired types', async () => {
  const testContext = await fixture();
  try {
    const carla = testContext.worker('carla');
    await carla.cacheAssignment(assignmentFixture('carla'));
    const action = await carla.enqueueDocument(
      'passport',
      testContext.image('carla'),
      'seed-carla-passport',
    );
    const next = assignmentFixture('carla');
    next.serverRevision = 2;
    next.requiredDocuments = next.requiredDocuments.filter(
      (document) => document.documentType !== 'passport',
    );
    await carla.cacheAssignment(next);
    assert.equal((await carla.listActions())[0]?.fileUri, action.fileUri);
    assert.equal((await carla.listSubmissions()).length, 2);
    assert.equal(
      (await carla.getAssignment())?.requiredDocuments.some(
        (document) => document.documentType === 'passport',
      ),
      false,
    );
    await assert.rejects(
      carla.enqueueDocument('passport', testContext.image('carla')),
      /document_not_in_catalog/,
    );
  } finally {
    await testContext.close();
  }
});

test('cached newer terms never substitute the exact version passed to confirmation', async () => {
  const testContext = await fixture();
  try {
    const ana = testContext.worker('ana');
    await ana.cacheAssignment(assignmentFixture('ana'));
    const next = assignmentFixture('ana');
    next.serverRevision = 2;
    next.terms.termsVersionId = 'v3';
    await ana.cacheAssignment(next);
    const previousAction = await ana.enqueueTerms('v2');
    assert.equal(
      previousAction.payload.kind === 'terms_acceptance' &&
        previousAction.payload.termsVersionId,
      'v2',
    );
    assert.equal((await ana.getAssignment())?.terms.termsVersionId, 'v3');
    assert.equal(
      (await ana.getAssignment())?.terms.serverAcceptanceStatus,
      'not_confirmed',
    );
  } finally {
    await testContext.close();
  }
});

test('native probe accepts repeated recovery after reopen but rejects changed intent or retry metadata', async () => {
  const { assertRecoverySnapshot } =
    await import('../../src/testing/recovery-snapshot.ts');
  const testContext = await fixture();
  try {
    const worker = testContext.worker('ana');
    await worker.cacheAssignment(assignmentFixture('ana'));
    const action = await worker.enqueueTerms('v2');
    await worker.claimAction(action.id, 100);
    const expected = await worker.listActions();
    await testContext.reopen();
    assert.equal(
      assertRecoverySnapshot(
        expected,
        await testContext.worker('ana').listActions(),
      ),
      1,
    );
    await testContext.worker('ana').recoverSending();
    await testContext.reopen();
    const recovered = await testContext.worker('ana').listActions();
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
    await testContext.close();
  }
});

test('persisted action JSON is validated before listing or dispatch eligibility without deleting intent', async () => {
  const testContext = await fixture();
  try {
    const worker = testContext.worker('ana');
    await worker.cacheAssignment(assignmentFixture('ana'));
    const actionId = randomUUID();
    const valid = {
      kind: 'terms_acceptance',
      workerId: 'ana',
      clientActionId: actionId,
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
        localSubmissionId: actionId,
        sha256: 'not-a-digest',
        replacesSubmissionId: null,
      }),
    ];
    for (const json of invalid) {
      await testContext.database.run(
        `INSERT INTO outbox_actions
        (id,worker_id,client_action_id,action_type,payload_json,status,next_attempt_at,created_at,updated_at)
        VALUES (?,?,?,?,?,'queued',0,100,100)`,
        [
          actionId,
          'ana',
          actionId,
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
          await testContext.database.first<{ count: number }>(
            'SELECT COUNT(*) AS count FROM outbox_actions WHERE worker_id=?',
            ['ana'],
          )
        )?.count,
        1,
      );
      await testContext.database.run(
        'DELETE FROM outbox_actions WHERE worker_id=? AND client_action_id=?',
        ['ana', actionId],
      );
    }
    const terms = await worker.enqueueTerms('v2');
    const upload = await worker.enqueueDocument(
      'passport',
      testContext.image(),
    );
    await testContext.reopen();
    assert.deepEqual(
      (await testContext.worker('ana').listActions()).map(
        (action) => action.payload,
      ),
      [terms.payload, upload.payload],
    );
  } finally {
    await testContext.close();
  }
});

test('persisted localized summaries and catalog labels reject malformed shapes', async () => {
  const testContext = await fixture();
  try {
    const worker = testContext.worker('ana');
    await worker.cacheAssignment(assignmentFixture('ana'));
    for (const json of [
      '{broken',
      'null',
      '[]',
      '{}',
      '{"es":"texto","en":3}',
      '{"es":" ","en":"text"}',
    ]) {
      await testContext.database.run(
        'UPDATE terms SET content_json=? WHERE worker_id=?',
        [json, 'ana'],
      );
      await assert.rejects(worker.getAssignment(), /invalid_persisted/);
    }
    await worker.cacheAssignment(assignmentFixture('ana'));
    await testContext.database.run(
      'UPDATE document_catalog SET content_json=? WHERE worker_id=? AND document_type=?',
      ['{"es":"texto"}', 'ana', 'passport'],
    );
    await assert.rejects(
      worker.getAssignment(),
      /invalid_persisted_localized_text/,
    );
  } finally {
    await testContext.close();
  }
});
