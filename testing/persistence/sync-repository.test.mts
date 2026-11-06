import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncFixture, receipt } from './sync-fixture.mts';
import { assignmentFixture } from '../../src/testing/persistence-fixtures.ts';
import { migrateDatabase } from '../../src/core/database/migrations/index.ts';

test('v1 -> v2 migration preserves intent and refresh flags, is repeatable and reopens', async () => {
  const testContext = await syncFixture();
  try {
    const action = await testContext.worker().enqueueTerms('v2');
    await testContext.database.run(
      'UPDATE refresh_state SET terms_refresh_needed=1 WHERE worker_id=?',
      ['ana'],
    );
    // Reconstruct the shipped v1 schema by removing only fields introduced by v2.
    await testContext.database.exec(
      'ALTER TABLE refresh_state DROP COLUMN attempt_count; ALTER TABLE refresh_state DROP COLUMN next_attempt_at; ALTER TABLE refresh_state DROP COLUMN last_error_code; DROP TABLE app_settings; PRAGMA user_version=1',
    );
    await migrateDatabase(testContext.database);
    await migrateDatabase(testContext.database);
    await testContext.reopen();
    assert.equal((await testContext.worker().listActions())[0]?.id, action.id);
    assert.deepEqual(await testContext.store().refreshState(), {
      needed: true,
      blocked: false,
      attemptCount: 0,
      nextAttemptAt: 0,
    });
  } finally {
    await testContext.close();
  }
});

for (const revision of [null, 1] as const) {
  test(`ack with ${revision === null ? 'missing' : 'older'} review revision resolves delivery but preserves known staff decision`, async () => {
    const testContext = await syncFixture();
    try {
      const action = await testContext
        .worker()
        .enqueueDocument('passport', testContext.image());
      await testContext.store().claimAction(action.id, 100);
      const original = receipt(action, 2);
      assert.equal(original.kind, 'document_upload');
      if (original.kind !== 'document_upload') throw new Error('wrong_fixture');
      const snapshot = assignmentFixture('ana');
      snapshot.serverRevision = 5;
      snapshot.documentSubmissions = [
        {
          submissionId: original.submissionId,
          clientActionId: action.id,
          documentType: 'passport',
          status: 'correction_requested',
          correctionReason: 'Foto borrosa, vuelva a tomarla',
          serverRevision: 5,
          createdAt: 80,
        },
      ];
      await testContext.worker().cacheAssignment(snapshot);
      await testContext.store().finish(
        action,
        {
          kind: 'delivered',
          receipt: { ...original, serverRevision: revision },
        },
        101,
      );
      await testContext.reopen();
      const submission = (await testContext.worker().listSubmissions())[0];
      assert.equal(submission?.deliveryStatus, 'delivered');
      assert.equal(submission?.serverStatus, 'correction_requested');
      assert.equal(submission?.serverRevision, 5);
      assert.equal(
        submission?.correctionReason,
        'Foto borrosa, vuelva a tomarla',
      );
      assert.equal((await testContext.store().refreshState()).needed, true);
    } finally {
      await testContext.close();
    }
  });
}

test('ack conflict and late transactional failure roll back delivery and business changes', async () => {
  const testContext = await syncFixture();
  try {
    const action = await testContext
      .worker()
      .enqueueDocument('passport', testContext.image());
    await testContext.store().claimAction(action.id, 100);
    const original = receipt(action, 2);
    if (original.kind !== 'document_upload') throw new Error('wrong_fixture');
    const snapshot = assignmentFixture('ana');
    snapshot.serverRevision = 2;
    snapshot.documentSubmissions = [
      {
        submissionId: original.submissionId,
        clientActionId: action.id,
        documentType: 'passport',
        status: 'approved',
        correctionReason: null,
        serverRevision: 2,
        createdAt: 80,
      },
    ];
    await testContext.worker().cacheAssignment(snapshot);
    await assert.rejects(
      testContext
        .store()
        .finish(action, { kind: 'delivered', receipt: original }, 101),
      /conflicting_review_revision/,
    );
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'sending',
    );
    await assert.rejects(
      testContext
        .store('carla')
        .finish(action, { kind: 'delivered', receipt: original }, 101),
      /worker_mismatch/,
    );
    await testContext.database.exec(
      "CREATE TRIGGER reject_ack BEFORE UPDATE OF status ON outbox_actions WHEN NEW.status='delivered' BEGIN SELECT RAISE(ABORT,'test_ack_failure'); END",
    );
    await assert.rejects(
      testContext
        .store()
        .finish(
          action,
          { kind: 'delivered', receipt: { ...original, status: 'approved' } },
          101,
        ),
      /test_ack_failure/,
    );
    assert.equal((await testContext.store().refreshState()).needed, false);
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'sending',
    );
    await testContext.database.exec('DROP TRIGGER reject_ack');
    await testContext
      .store()
      .finish(
        action,
        { kind: 'delivered', receipt: { ...original, status: 'approved' } },
        101,
      );
    assert.equal(
      (await testContext.worker().listActions())[0]?.status,
      'delivered',
    );
  } finally {
    await testContext.close();
  }
});

test('missing revision can initialize Pending Review without inventing approval', async () => {
  const testContext = await syncFixture();
  try {
    const action = await testContext
      .worker()
      .enqueueDocument('passport', testContext.image());
    await testContext.store().claimAction(action.id, 100);
    const original = receipt(action);
    await testContext
      .store()
      .finish(
        action,
        { kind: 'delivered', receipt: { ...original, serverRevision: null } },
        100,
      );
    const submission = (await testContext.worker().listSubmissions())[0];
    assert.equal(submission?.serverStatus, 'pending_review');
    assert.equal(submission?.serverRevision, null);
    assert.equal(submission?.deliveryStatus, 'delivered');
    assert.equal((await testContext.store().refreshState()).needed, true);
  } finally {
    await testContext.close();
  }
});

test('equal-review refresh fills receipt-missing server creation time and latest-server projection', async () => {
  const testContext = await syncFixture();
  try {
    const action = await testContext
      .worker()
      .enqueueDocument('passport', testContext.image());
    await testContext.store().claimAction(action.id, 100);
    const original = receipt(action, 2);
    if (original.kind !== 'document_upload') throw new Error('wrong_fixture');
    await testContext
      .store()
      .finish(action, { kind: 'delivered', receipt: original }, 100);
    const snapshot = assignmentFixture('ana');
    snapshot.serverRevision = 2;
    snapshot.documentSubmissions = [
      {
        submissionId: original.submissionId,
        clientActionId: action.id,
        documentType: 'passport',
        status: 'pending_review',
        correctionReason: null,
        serverRevision: 2,
        createdAt: 90,
      },
    ];
    await testContext.store().cacheRefresh(snapshot);
    assert.equal(
      (await testContext.worker().listSubmissions())[0]?.serverCreatedAt,
      90,
    );
    assert.equal(
      (
        await testContext.database.first<{ id: string }>(
          'SELECT latest_server_submission_id AS id FROM documents WHERE worker_id=? AND document_type=?',
          ['ana', 'passport'],
        )
      )?.id,
      original.submissionId,
    );
  } finally {
    await testContext.close();
  }
});

test('stale intent never creates acceptance or erases an earlier acknowledged historical acceptance', async () => {
  const testContext = await syncFixture();
  try {
    const first = await testContext.worker().enqueueTerms('v2');
    await testContext.store().claimAction(first.id, 100);
    await testContext
      .store()
      .finish(first, { kind: 'delivered', receipt: receipt(first) }, 100);
    const later = await testContext.worker().enqueueTerms('v2');
    await testContext.store().claimAction(later.id, 100);
    await testContext.store().finish(later, { kind: 'stale' }, 100);
    assert.deepEqual(
      (await testContext.worker().listActions()).map((action) => action.status),
      ['delivered', 'stale'],
    );
    assert.equal(
      (await testContext.worker().getAssignment())?.terms
        .serverAcceptanceStatus,
      'accepted',
    );
    assert.equal((await testContext.store().refreshState()).needed, true);
  } finally {
    await testContext.close();
  }
});

test('claim release is worker/action scoped and never rewinds a committed completion', async () => {
  const testContext = await syncFixture();
  try {
    const first = await testContext.worker().enqueueTerms('v2');
    const next = await testContext.worker().enqueueTerms('v2');
    await testContext.store().claimAction(first.id, 100);
    await testContext.store().claimAction(next.id, 100);
    await testContext.store('carla').releaseClaim(first.id, 101);
    assert.deepEqual(
      (await testContext.worker().listActions()).map((action) => action.status),
      ['sending', 'sending'],
    );
    await testContext.store().releaseClaim(first.id, 101);
    assert.deepEqual(
      (await testContext.worker().listActions()).map((action) => action.status),
      ['queued', 'sending'],
    );
    assert.equal(
      (await testContext.worker().listActions())[0]?.attemptCount,
      1,
    );
    assert.deepEqual(
      (await testContext.worker().listActions())[0]?.payload,
      first.payload,
    );
    await testContext
      .store()
      .finish(next, { kind: 'delivered', receipt: receipt(next) }, 101);
    await testContext.store().releaseClaim(next.id, 102);
    assert.equal(
      (await testContext.worker().listActions())[1]?.status,
      'delivered',
    );
  } finally {
    await testContext.close();
  }
});
