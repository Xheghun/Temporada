import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';
import { runMediaJourney } from './media-journey.mjs';

export async function runScenarioThree(context) {
  const { flow, output, restartBackend } = context;
  const device = androidDevice(context);
  const translations = JSON.parse(
    await readFile('src/core/i18n/es.json', 'utf8'),
  );
  return runMediaJourney({
    ...context,
    language: 'es',
    includeGallery: false,
    primaryDocument: 'ds160_confirmation',
    primarySource: 'gallery',
    async afterSave(before) {
      const original = before.actions[0];
      assert.equal(original.documentType, 'ds160_confirmation');
      await fixtureRequest('/__dev/failures', { dropNextResponse: true });
      const restart = process.env.E2E_BACKEND_RESTART === '1';
      if (restart)
        await fixtureRequest('/__dev/replays', {
          workerId: 'ana',
          clientActionId: original.clientActionId,
          mode: 'hold',
          timeoutMs: 120000,
        });
      await device.online();
      const committed = await waitForObservation(
        'post-commit response drop',
        () => fixtureRequest('/__dev/state'),
        (state) =>
          state.receipts.some(
            (receipt) =>
              receipt.workerId === 'ana' &&
              receipt.clientActionId === original.clientActionId,
          ),
      );
      const droppedTrace = await waitForObservation(
        'lost connection after commit',
        () => fixtureRequest('/__dev/trace'),
        (trace) =>
          trace.entries.some(
            (attempt) =>
              attempt.clientActionId === original.clientActionId &&
              attempt.outcome === 'connection_lost',
          ),
      );
      if (restart) {
        await waitForObservation(
          'replay held before backend restart',
          () => fixtureRequest('/__dev/replays'),
          (state) =>
            state.rules.some(
              (rule) =>
                rule.clientActionId === original.clientActionId &&
                rule.pending > 0,
            ),
        );
        await restartBackend();
        assert.deepEqual(
          await fixtureRequest('/__dev/state'),
          committed,
          'Backend restart changed persistent effects or receipt identity',
        );
      }
      const delivered = await waitForObservation(
        'same-action replay delivery',
        () => inspectNative(context),
        (inspection) => inspection.actions[0]?.status === 'delivered',
      );
      const server = await fixtureRequest('/__dev/state');
      const finalTrace = await fixtureRequest('/__dev/trace');
      const attempts = restart
        ? [...droppedTrace.entries, ...finalTrace.entries]
        : finalTrace.entries;
      const uploads = attempts.filter(
        (attempt) =>
          attempt.operation === 'document' && attempt.workerId === 'ana',
      );
      assert(
        uploads.length >= 2,
        'Expected commit/drop and a real replay attempt',
      );
      assert(
        uploads.every(
          (attempt) => attempt.clientActionId === original.clientActionId,
        ),
      );
      assert.equal(
        server.receipts.filter(
          (receipt) =>
            receipt.workerId === 'ana' &&
            receipt.clientActionId === original.clientActionId,
        ).length,
        1,
      );
      const submissions = server.documentSubmissions.filter(
        (submission) => submission.workerId === 'ana',
      );
      assert.equal(submissions.length, 1);
      assert.equal(submissions[0].clientActionId, original.clientActionId);
      assert.equal(submissions[0].documentType, 'ds160_confirmation');
      assert.equal(submissions[0].status, 'pending_review');
      assert.equal(
        delivered.actions[0].clientActionId,
        original.clientActionId,
      );
      await flow('upload-pending-review', {
        REVIEW_LABEL: translations.documents.status.pending_review,
      });
      await writeFile(
        path.join(output, 'scenario-3.json'),
        JSON.stringify(
          {
            status: 'PASS',
            tests: ['TEST-03'],
            requirements: ['M2', 'M3', 'M4'],
            backendRestart: restart,
            before,
            delivered,
            server,
            droppedTrace,
            finalTrace,
          },
          null,
          2,
        ),
      );
    },
  });
}
