import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';
import { runMediaJourney } from './media-journey.mjs';

const reason = 'Foto borrosa, vuelva a tomarla';
export async function runScenarioSeven(context) {
  const { flow, output } = context;
  const device = androidDevice(context);
  const translations = JSON.parse(
    await readFile('src/core/i18n/es.json', 'utf8'),
  );
  const carla = { ...context, workerId: 'carla' };
  const bruno = { ...context, workerId: 'bruno' };
  const switchTo = (workerId, name) =>
    flow('switch-worker', { WORKER_ID: workerId, WORKER_NAME: `.*${name}.*` });
  await flow('correction-reason', { REASON_LABEL: `.*${reason}.*` });
  // Cache both workers before the offline isolation check.
  await switchTo('bruno', 'Bruno Díaz');
  await inspectNative(bruno);
  await switchTo('carla', 'Carla Díaz');
  const initial = await inspectNative(carla);
  const historical = initial.submissions.find(
    (submission) => submission.serverSubmissionId === 'seed-carla-passport',
  );
  assert.equal(historical.status, 'correction_requested');
  assert.equal(historical.correctionReason, reason);
  return runMediaJourney({
    ...context,
    workerId: 'carla',
    language: 'es',
    primarySource: 'gallery',
    includeGallery: false,
    async afterSave(before) {
      const replacement = before.actions[0];
      assert.equal(replacement.replacesSubmissionId, 'seed-carla-passport');
      assert.notEqual(replacement.submissionId, 'seed-carla-passport');
      const traceBefore = await fixtureRequest('/__dev/trace');
      await switchTo('bruno', 'Bruno Díaz');
      await flow('shared-worker-state', {
        WORKER_NAME: '.*Bruno Díaz.*',
        OTHER_WORKER_NAME: '.*Carla Díaz.*',
        COUNT_LABEL: translations.home.pending_other.replace('{{count}}', '0'),
      });
      const brunoView = await inspectNative(bruno);
      assert.equal(brunoView.workerId, 'bruno');
      assert.equal(brunoView.actions.length, 0);
      assert(
        brunoView.submissions.every(
          (submission) =>
            submission.serverSubmissionId === 'seed-bruno-passport',
        ),
      );
      assert(!JSON.stringify(brunoView).includes(reason));
      assert(!JSON.stringify(brunoView).includes(replacement.clientActionId));
      await switchTo('carla', 'Carla Díaz');
      await flow('shared-worker-state', {
        WORKER_NAME: '.*Carla Díaz.*',
        OTHER_WORKER_NAME: '.*Bruno Díaz.*',
        COUNT_LABEL: translations.home.pending_one.replace('{{count}}', '1'),
      });
      const returned = await inspectNative(carla);
      assert.deepEqual(
        returned.actions,
        before.actions,
        'Worker switch lost Carla’s pending action or private bytes',
      );
      assert.equal(
        (await fixtureRequest('/__dev/trace')).totalAttempts,
        traceBefore.totalAttempts,
        'Switching workers sent while offline',
      );
      await device.online();
      const delivered = await waitForObservation(
        'Carla replacement delivered',
        () => inspectNative(carla),
        (inspection) => inspection.actions[0]?.status === 'delivered',
      );
      const old = delivered.submissions.find(
        (submission) => submission.serverSubmissionId === 'seed-carla-passport',
      );
      assert.equal(old.status, historical.status);
      assert.equal(old.correctionReason, reason);
      assert.equal(old.serverRevision, historical.serverRevision);
      const server = await fixtureRequest('/__dev/state');
      const uploads = server.documentSubmissions.filter(
        (submission) => submission.workerId === 'carla',
      );
      assert.equal(uploads.length, 2);
      assert.equal(
        uploads.filter(
          (submission) =>
            submission.clientActionId === replacement.clientActionId,
        ).length,
        1,
      );
      const trace = await fixtureRequest('/__dev/trace');
      assert(
        trace.entries
          .filter(
            (attempt) =>
              attempt.operation === 'document' &&
              attempt.clientActionId === replacement.clientActionId,
          )
          .every((attempt) => attempt.workerId === 'carla'),
      );
      await writeFile(
        path.join(output, 'scenario-7.json'),
        JSON.stringify(
          {
            status: 'PASS',
            requirements: ['M2', 'M3', 'M8', 'M10'],
            tests: ['TEST-06'],
            initial,
            before,
            brunoView,
            returned,
            delivered,
            server,
            trace,
          },
          null,
          2,
        ),
      );
    },
  });
}
