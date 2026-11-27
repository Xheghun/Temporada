import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';
import { runMediaJourney } from './media-journey.mjs';

/** Original brief 2: terms and actual camera bytes survive an offline process restart. */
export async function runScenarioTwo(context) {
  const { flow, output } = context;
  const device = androidDevice(context);
  const translations = JSON.parse(
    await readFile('src/core/i18n/es.json', 'utf8'),
  );
  const baseline = await fixtureRequest('/__dev/state');
  await device.offline();
  const traceBefore = await fixtureRequest('/__dev/trace');
  return runMediaJourney({
    ...context,
    language: 'es',
    includeGallery: false,
    async beforeCapture() {
      await flow('terms-confirm', {
        VERSION_LABEL: translations.terms.version.replace('{{version}}', 'v2'),
        TERMS_PENDING_LABEL: translations.terms.status.pending_sync,
      });
    },
    async afterSave(before) {
      assert.equal(before.actions.length, 2);
      assert.deepEqual(
        before.actions.map((action) => action.actionType).sort(),
        ['document_upload', 'terms_acceptance'],
      );
      const actionIds = before.actions.map((action) => action.clientActionId);
      assert.equal(new Set(actionIds).size, 2);
      assert(
        before.actions.every(
          (action) => action.status === 'queued' && action.attemptCount === 0,
        ),
      );
      assert.deepEqual(
        await fixtureRequest('/__dev/state'),
        baseline,
        'Offline work changed backend effects',
      );
      assert.equal(
        (await fixtureRequest('/__dev/trace')).totalAttempts,
        traceBefore.totalAttempts,
        'A request was sent offline',
      );
      await device.forceStop();
      if (process.env.E2E_REBOOT_VARIANT === '1') await device.reboot();
      await device.relaunch();
      await flow('device-offline');
      const reopened = await inspectNative(context);
      assert.deepEqual(
        reopened.actions,
        before.actions,
        'Restart changed action IDs, metadata or private bytes',
      );
      assert.deepEqual(reopened.submissions, before.submissions);
      assert.equal(
        (await fixtureRequest('/__dev/trace')).totalAttempts,
        traceBefore.totalAttempts,
      );
      await device.online();
      const server = await waitForObservation(
        'one effect per original action',
        () => fixtureRequest('/__dev/state'),
        (state) =>
          state.receipts.filter((receipt) =>
            actionIds.includes(receipt.clientActionId),
          ).length === 2,
      );
      for (const clientActionId of actionIds)
        assert.equal(
          server.receipts.filter(
            (receipt) =>
              receipt.workerId === 'ana' &&
              receipt.clientActionId === clientActionId,
          ).length,
          1,
        );
      const acceptances = server.acceptances.filter(
        (acceptance) => acceptance.workerId === 'ana',
      );
      const documents = server.documentSubmissions.filter(
        (submission) => submission.workerId === 'ana',
      );
      assert.equal(acceptances.length, 1);
      assert.equal(documents.length, 1);
      assert.equal(documents[0].documentType, 'passport');
      assert.equal(documents[0].status, 'pending_review');
      assert(actionIds.includes(documents[0].clientActionId));
      await flow('passport-pending-review', {
        REVIEW_LABEL: translations.documents.status.pending_review,
      });
      const delivered = await waitForObservation(
        'local delivery completion',
        () => inspectNative(context),
        (inspection) =>
          inspection.actions.every((action) => action.status === 'delivered'),
      );
      assert.deepEqual(
        delivered.actions.map((action) => action.clientActionId),
        actionIds,
      );
      assert.equal(delivered.submissions[0].status, 'pending_review');
      await writeFile(
        path.join(output, 'scenario-2.json'),
        JSON.stringify(
          {
            status: 'PASS',
            requirements: ['M1', 'M2', 'M3', 'M4', 'M6', 'M7'],
            tests: ['TEST-01', 'TEST-02'],
            reboot: process.env.E2E_REBOOT_VARIANT === '1',
            before,
            reopened,
            delivered,
            server,
            trace: await fixtureRequest('/__dev/trace'),
          },
          null,
          2,
        ),
      );
    },
  });
}
