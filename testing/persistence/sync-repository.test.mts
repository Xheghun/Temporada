import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncFixture, receipt } from './sync-fixture.mts';
import { assignmentFixture } from '../../src/testing/persistence-fixtures.ts';
import { migrateDatabase } from '../../src/core/database/migrations/index.ts';

test('v1 -> v2 migration preserves intent and refresh flags, is repeatable and reopens', async () => {
  const f = await syncFixture();
  try {
    const action = await f.worker().enqueueTerms('v2');
    await f.db.run(
      'UPDATE refresh_state SET terms_refresh_needed=1 WHERE worker_id=?',
      ['ana'],
    );
    // Reconstruct the shipped v1 schema by removing only fields introduced by v2.
    await f.db.exec(
      'ALTER TABLE refresh_state DROP COLUMN attempt_count; ALTER TABLE refresh_state DROP COLUMN next_attempt_at; ALTER TABLE refresh_state DROP COLUMN last_error_code; DROP TABLE app_settings; PRAGMA user_version=1',
    );
    await migrateDatabase(f.db);
    await migrateDatabase(f.db);
    await f.reopen();
    assert.equal((await f.worker().listActions())[0]?.id, action.id);
    assert.deepEqual(await f.store().refreshState(), {
      needed: true,
      blocked: false,
      attemptCount: 0,
      nextAttemptAt: 0,
    });
  } finally {
    await f.close();
  }
});

for (const revision of [null, 1] as const) {
  test(`ack with ${revision === null ? 'missing' : 'older'} review revision resolves delivery but preserves known staff decision`, async () => {
    const f = await syncFixture();
    try {
      const action = await f.worker().enqueueDocument('passport', f.image());
      await f.store().claimAction(action.id, 100);
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
      await f.worker().cacheAssignment(snapshot);
      await f.store().finish(
        action,
        {
          kind: 'delivered',
          receipt: { ...original, serverRevision: revision },
        },
        101,
      );
      await f.reopen();
      const row = (await f.worker().listSubmissions())[0];
      assert.equal(row?.deliveryStatus, 'delivered');
      assert.equal(row?.serverStatus, 'correction_requested');
      assert.equal(row?.serverRevision, 5);
      assert.equal(row?.correctionReason, 'Foto borrosa, vuelva a tomarla');
      assert.equal((await f.store().refreshState()).needed, true);
    } finally {
      await f.close();
    }
  });
}

test('ack conflict and late transactional failure roll back delivery and business changes', async () => {
  const f = await syncFixture();
  try {
    const action = await f.worker().enqueueDocument('passport', f.image());
    await f.store().claimAction(action.id, 100);
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
    await f.worker().cacheAssignment(snapshot);
    await assert.rejects(
      f.store().finish(action, { kind: 'delivered', receipt: original }, 101),
      /conflicting_review_revision/,
    );
    assert.equal((await f.worker().listActions())[0]?.status, 'sending');
    await assert.rejects(
      f
        .store('carla')
        .finish(action, { kind: 'delivered', receipt: original }, 101),
      /worker_mismatch/,
    );
    await f.db.exec(
      "CREATE TRIGGER reject_ack BEFORE UPDATE OF status ON outbox_actions WHEN NEW.status='delivered' BEGIN SELECT RAISE(ABORT,'test_ack_failure'); END",
    );
    await assert.rejects(
      f
        .store()
        .finish(
          action,
          { kind: 'delivered', receipt: { ...original, status: 'approved' } },
          101,
        ),
      /test_ack_failure/,
    );
    assert.equal((await f.store().refreshState()).needed, false);
    assert.equal((await f.worker().listActions())[0]?.status, 'sending');
    await f.db.exec('DROP TRIGGER reject_ack');
    await f
      .store()
      .finish(
        action,
        { kind: 'delivered', receipt: { ...original, status: 'approved' } },
        101,
      );
    assert.equal((await f.worker().listActions())[0]?.status, 'delivered');
  } finally {
    await f.close();
  }
});

test('missing revision can initialize Pending Review without inventing approval', async () => {
  const f = await syncFixture();
  try {
    const action = await f.worker().enqueueDocument('passport', f.image());
    await f.store().claimAction(action.id, 100);
    const original = receipt(action);
    await f
      .store()
      .finish(
        action,
        { kind: 'delivered', receipt: { ...original, serverRevision: null } },
        100,
      );
    const row = (await f.worker().listSubmissions())[0];
    assert.equal(row?.serverStatus, 'pending_review');
    assert.equal(row?.serverRevision, null);
    assert.equal(row?.deliveryStatus, 'delivered');
    assert.equal((await f.store().refreshState()).needed, true);
  } finally {
    await f.close();
  }
});

test('equal-review refresh fills receipt-missing server creation time and latest-server projection', async () => {
  const f = await syncFixture();
  try {
    const action = await f.worker().enqueueDocument('passport', f.image());
    await f.store().claimAction(action.id, 100);
    const original = receipt(action, 2);
    if (original.kind !== 'document_upload') throw new Error('wrong_fixture');
    await f
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
    await f.store().cacheRefresh(snapshot);
    assert.equal((await f.worker().listSubmissions())[0]?.serverCreatedAt, 90);
    assert.equal(
      (
        await f.db.first<{ id: string }>(
          'SELECT latest_server_submission_id AS id FROM documents WHERE worker_id=? AND document_type=?',
          ['ana', 'passport'],
        )
      )?.id,
      original.submissionId,
    );
  } finally {
    await f.close();
  }
});

test('stale intent never creates acceptance or erases an earlier acknowledged historical acceptance', async () => {
  const f = await syncFixture();
  try {
    const first = await f.worker().enqueueTerms('v2');
    await f.store().claimAction(first.id, 100);
    await f
      .store()
      .finish(first, { kind: 'delivered', receipt: receipt(first) }, 100);
    const later = await f.worker().enqueueTerms('v2');
    await f.store().claimAction(later.id, 100);
    await f.store().finish(later, { kind: 'stale' }, 100);
    assert.deepEqual(
      (await f.worker().listActions()).map((a) => a.status),
      ['delivered', 'stale'],
    );
    assert.equal(
      (await f.worker().getAssignment())?.terms.serverAcceptanceStatus,
      'accepted',
    );
    assert.equal((await f.store().refreshState()).needed, true);
  } finally {
    await f.close();
  }
});

test('claim release is worker/action scoped and never rewinds a committed completion', async () => {
  const f = await syncFixture();
  try {
    const first = await f.worker().enqueueTerms('v2');
    const next = await f.worker().enqueueTerms('v2');
    await f.store().claimAction(first.id, 100);
    await f.store().claimAction(next.id, 100);
    await f.store('carla').releaseClaim(first.id, 101);
    assert.deepEqual(
      (await f.worker().listActions()).map((a) => a.status),
      ['sending', 'sending'],
    );
    await f.store().releaseClaim(first.id, 101);
    assert.deepEqual(
      (await f.worker().listActions()).map((a) => a.status),
      ['queued', 'sending'],
    );
    assert.equal((await f.worker().listActions())[0]?.attemptCount, 1);
    assert.deepEqual(
      (await f.worker().listActions())[0]?.payload,
      first.payload,
    );
    await f
      .store()
      .finish(next, { kind: 'delivered', receipt: receipt(next) }, 101);
    await f.store().releaseClaim(next.id, 102);
    assert.equal((await f.worker().listActions())[1]?.status, 'delivered');
  } finally {
    await f.close();
  }
});
