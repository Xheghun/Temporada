import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';
import { runMediaJourney } from './media-journey.mjs';

export async function runScenarioEight(context) {
  const { adb, flow, output } = context;
  const device = androidDevice(context);
  const translations = JSON.parse(
    await readFile('src/core/i18n/es.json', 'utf8'),
  );
  const logout = process.env.E2E_LOGOUT_VARIANT === '1';
  return runMediaJourney({
    ...context,
    language: 'es',
    primarySource: 'gallery',
    includeGallery: false,
    async afterSave(before) {
      const original = before.actions[0];
      if (logout) await flow('logout');
      else await fixtureRequest('/__dev/expire-sessions', {});
      // Successful reauthentication must not race away the retained bytes before inspection.
      await fixtureRequest('/__dev/failures', { serverErrorRate: 1 });
      await flow('probe-airplane-off');
      await adb('shell', 'svc', 'wifi', 'enable');
      await flow('auth-required');
      const paused = await fixtureRequest('/__dev/trace');
      if (!logout)
        assert(
          paused.entries.some(
            (attempt) => attempt.workerId === 'ana' && attempt.status === 401,
          ),
          'Session expiry did not produce a real 401',
        );
      await new Promise((resolve) => setTimeout(resolve, 3000));
      assert.equal(
        (await fixtureRequest('/__dev/trace')).totalAttempts,
        paused.totalAttempts,
        'Delivery continued without authentication',
      );
      await flow('bootstrap-sign-in');
      const restored = await inspectNative(context);
      assert.equal(restored.actions.length, 1);
      const retained = restored.actions[0];
      assert.equal(retained.clientActionId, original.clientActionId);
      assert.equal(retained.submissionId, original.submissionId);
      assert.equal(retained.digest, original.digest);
      assert.equal(retained.bytes, original.bytes);
      assert.equal(retained.exists, true);
      assert.equal(retained.ownsPrivateFile, true);
      assert.equal(retained.digestMatches, true);
      const beforeResume = await fixtureRequest('/__dev/state');
      assert.equal(
        beforeResume.documentSubmissions.filter(
          (submission) => submission.workerId === 'ana',
        ).length,
        0,
      );
      await fixtureRequest('/__dev/failures', { serverErrorRate: 0 });
      await device.relaunch();
      const delivered = await waitForObservation(
        'authorized same-ID resumption',
        () => inspectNative(context),
        (inspection) => inspection.actions[0]?.status === 'delivered',
      );
      assert.equal(
        delivered.actions[0].clientActionId,
        original.clientActionId,
      );
      const server = await fixtureRequest('/__dev/state');
      assert.equal(
        server.receipts.filter(
          (receipt) =>
            receipt.workerId === 'ana' &&
            receipt.clientActionId === original.clientActionId,
        ).length,
        1,
      );
      assert.equal(
        server.documentSubmissions.filter(
          (submission) => submission.workerId === 'ana',
        ).length,
        1,
      );
      await flow('upload-pending-review', {
        REVIEW_LABEL: translations.documents.status.pending_review,
      });
      await writeFile(
        path.join(output, 'scenario-8.json'),
        JSON.stringify(
          {
            status: 'PASS',
            logout,
            requirements: ['M1', 'M2', 'M3', 'M10'],
            before,
            paused,
            restored,
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
