import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';
import { runMediaJourney } from './media-journey.mjs';

export async function runReplayJourney(context, status) {
  assert(['approved', 'correction_requested'].includes(status));
  const { adb, flow, output } = context;
  const device = androidDevice(context);
  const translations = JSON.parse(
    await readFile('src/core/i18n/es.json', 'utf8'),
  );
  return runMediaJourney({
    ...context,
    language: 'es',
    includeGallery: false,
    primarySource: 'gallery',
    async afterSave(before) {
      const original = before.actions[0];
      const control = {
        workerId: 'ana',
        clientActionId: original.clientActionId,
        timeoutMs: 120000,
      };
      await fixtureRequest('/__dev/failures', { dropNextResponse: true });
      await fixtureRequest('/__dev/replays', { ...control, mode: 'hold' });
      await flow('probe-airplane-off');
      await adb('shell', 'svc', 'wifi', 'enable');
      const held = await waitForObservation(
        'original replay held',
        () => fixtureRequest('/__dev/replays'),
        (state) =>
          state.rules.some(
            (rule) =>
              rule.clientActionId === original.clientActionId &&
              rule.pending > 0,
          ),
      );
      const server = await fixtureRequest('/__dev/state');
      const submission = server.documentSubmissions.find(
        (submission) =>
          submission.workerId === 'ana' &&
          submission.clientActionId === original.clientActionId,
      );
      assert(submission);
      const reason =
        status === 'correction_requested'
          ? 'Foto borrosa, vuelva a tomarla'
          : null;
      const review = await fixtureRequest('/__dev/review', {
        submissionId: submission.submissionId,
        status,
        ...(reason ? { correctionReason: reason } : {}),
      });
      // The regular refresh requests work while replay is in flight; disconnect lets the engine service it.
      await flow('review-refresh');
      const disconnected = await fixtureRequest('/__dev/replays', {
        ...control,
        mode: 'disconnect',
      });
      const nextHeld = await waitForObservation(
        'refresh before next held replay',
        () => fixtureRequest('/__dev/replays'),
        (state) =>
          state.events.filter(
            (event) =>
              event.clientActionId === original.clientActionId &&
              event.event === 'held',
          ).length >= 2 &&
          state.rules.some(
            (rule) =>
              rule.clientActionId === original.clientActionId &&
              rule.pending > 0,
          ),
      );
      assert(
        !nextHeld.events.some((event) => event.event === 'expired'),
        'Replay barrier expired before review could be observed',
      );
      const refreshed = await inspectNative(context);
      const staff = refreshed.submissions.find(
        (candidate) => candidate.serverSubmissionId === submission.submissionId,
      );
      assert.equal(staff.status, status);
      assert.equal(staff.serverRevision, review.serverRevision);
      assert.equal(staff.correctionReason, reason);
      assert.notEqual(refreshed.actions[0].status, 'delivered');
      assert.equal(refreshed.actions[0].exists, true);
      assert.equal(refreshed.actions[0].digest, original.digest);
      // Native inspection can outlast a normal transport timeout. Keep retrying
      // the same held receipt, then release a live response after the snapshot.
      const releaseReady = await waitForObservation(
        'live replay after the newer review snapshot',
        () => fixtureRequest('/__dev/replays'),
        (state) =>
          state.rules.some(
            (rule) =>
              rule.clientActionId === original.clientActionId &&
              rule.pending > 0,
          ),
      );
      const released = await fixtureRequest('/__dev/replays', {
        ...control,
        mode: 'release',
      });
      assert.equal(
        released.released,
        1,
        'The original receipt was not explicitly released',
      );
      const delivered = await waitForObservation(
        'original receipt resolves only delivery',
        () => inspectNative(context),
        (inspection) => inspection.actions[0]?.status === 'delivered',
      );
      await device.forceStop();
      await device.relaunch();
      const reopened = await inspectNative(context);
      for (const inspection of [delivered, reopened]) {
        const retained = inspection.submissions.find(
          (candidate) =>
            candidate.serverSubmissionId === submission.submissionId,
        );
        assert.equal(retained.status, status);
        assert.equal(retained.serverRevision, review.serverRevision);
        assert.equal(retained.correctionReason, reason);
        assert.equal(
          inspection.actions[0].clientActionId,
          original.clientActionId,
        );
        assert.equal(inspection.actions[0].status, 'delivered');
      }
      await flow('upload-pending-review', {
        REVIEW_LABEL: translations.documents.status[status],
      });
      if (reason)
        await flow('correction-reason', { REASON_LABEL: `.*${reason}.*` });
      const finalServer = await fixtureRequest('/__dev/state');
      assert.equal(
        finalServer.receipts.filter(
          (receipt) =>
            receipt.workerId === 'ana' &&
            receipt.clientActionId === original.clientActionId,
        ).length,
        1,
      );
      assert.equal(
        finalServer.documentSubmissions.filter(
          (candidate) => candidate.workerId === 'ana',
        ).length,
        1,
      );
      const barriers = await fixtureRequest('/__dev/replays');
      assert(!barriers.events.some((event) => event.event === 'expired'));
      await writeFile(
        path.join(output, 'replay-review.json'),
        JSON.stringify(
          {
            status: 'PASS',
            reviewStatus: status,
            requirements: ['M2', 'M3', 'M4'],
            tests: ['TEST-03R'],
            before,
            held,
            review,
            disconnected,
            nextHeld,
            refreshed,
            releaseReady,
            released,
            delivered,
            reopened,
            finalServer,
            barriers,
            trace: await fixtureRequest('/__dev/trace'),
          },
          null,
          2,
        ),
      );
    },
  });
}
