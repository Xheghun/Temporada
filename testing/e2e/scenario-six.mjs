import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { readTapTimings } from './flow-timings.mjs';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';
import { runMediaJourney } from './media-journey.mjs';

async function correlateClock(adb) {
  const hostBefore = Date.now();
  const nanoseconds = await adb('shell', 'date', '+%s%N');
  const hostAfter = Date.now();
  assert(
    /^\d{19}$/.test(nanoseconds),
    'Device nanosecond clock output unavailable',
  );
  const deviceMs = Number(BigInt(nanoseconds) / 1_000_000n);
  return {
    hostBefore,
    hostAfter,
    deviceMs,
    offsetMin: deviceMs - hostAfter,
    offsetMax: deviceMs - hostBefore,
  };
}

export async function runScenarioSix(context) {
  const { adb, flow, output } = context;
  const device = androidDevice(context);
  const translations = JSON.parse(
    await readFile('src/core/i18n/es.json', 'utf8'),
  );
  const latency = process.env.E2E_LATENCY_VARIANT === '1';
  const controls = latency
    ? { latencyMs: 2000, serverErrorRate: 0, randomSeed: 281 }
    : { latencyMs: 0, serverErrorRate: 0.85, randomSeed: 281 };
  return runMediaJourney({
    ...context,
    language: 'es',
    includeGallery: false,
    expectedActionCount: 2,
    async beforeCapture() {
      await flow('terms-confirm', {
        VERSION_LABEL: translations.terms.version.replace('{{version}}', 'v2'),
        TERMS_PENDING_LABEL: translations.terms.status.pending_sync,
      });
    },
    async afterSave(before) {
      await fixtureRequest('/__dev/failures', controls);
      let latencyInteraction;
      if (latency) {
        const interaction = await flow('latency-interact');
        const taps = await readTapTimings(interaction.artifactDirectory);
        const trace = await fixtureRequest('/__dev/trace');
        const overlap = taps.filter(
          (tap) =>
            tap.status === 'COMPLETED' &&
            tap.actualTapAt !== null &&
            trace.entries.some(
              (attempt) =>
                attempt.operation !== 'assignment' &&
                tap.actualTapAt >= attempt.receivedAtUnixMs &&
                tap.actualTapAt < attempt.receivedAtUnixMs + 2000,
            ),
        );
        assert(
          overlap.length > 0,
          'No completed UI interaction overlapped the injected two-second request latency',
        );
        latencyInteraction = { taps, overlap, trace };
      } else {
        await device.online();
        await flow('retry-interact');
      }
      let backoff;
      let reopened;
      let clock;
      let firstPostRestartAttempt;
      if (!latency) {
        backoff = await waitForObservation(
          'long enough persisted backoff for restart',
          () => inspectNative(context),
          (inspection) =>
            inspection.actions.some(
              (action) =>
                action.status === 'retry_wait' &&
                action.attemptCount >= 7 &&
                action.nextAttemptAt - inspection.sampledAt >= 25_000,
            ),
          180_000,
        );
        const action = backoff.actions.find(
          (action) =>
            action.status === 'retry_wait' &&
            action.attemptCount >= 7 &&
            action.nextAttemptAt - backoff.sampledAt >= 25_000,
        );
        const delay = action.nextAttemptAt - action.updatedAt;
        const maximum = Math.min(60_000, 1000 * 2 ** (action.attemptCount - 1));
        assert(
          delay >= maximum / 2 && delay <= maximum,
          'Persisted backoff escaped equal-jitter bounds',
        );
        const traceBeforeRestart = await fixtureRequest('/__dev/trace');
        assert(
          traceBeforeRestart.entries.some((attempt) => attempt.status === 500),
          'Seeded 500s did not occur',
        );
        await device.forceStop();
        clock = await correlateClock(adb);
        assert(
          clock.deviceMs < action.nextAttemptAt,
          'Restart started after retry eligibility',
        );
        await device.relaunch();
        reopened = await inspectNative(context);
        const recovered = reopened.actions.find(
          (candidate) => candidate.clientActionId === action.clientActionId,
        );
        assert.equal(recovered.status, 'retry_wait');
        assert.equal(recovered.attemptCount, action.attemptCount);
        assert.equal(recovered.nextAttemptAt, action.nextAttemptAt);
        assert.equal(recovered.digest, action.digest);
        const afterRestartTrace = await fixtureRequest('/__dev/trace');
        assert.equal(
          afterRestartTrace.entries.filter(
            (attempt) => attempt.clientActionId === action.clientActionId,
          ).length,
          traceBeforeRestart.entries.filter(
            (attempt) => attempt.clientActionId === action.clientActionId,
          ).length,
          'Restart sent before eligibility',
        );
        await fixtureRequest('/__dev/failures', { serverErrorRate: 0 });
        firstPostRestartAttempt = await waitForObservation(
          'retry after original persisted deadline',
          () => fixtureRequest('/__dev/trace'),
          (trace) =>
            trace.entries.some(
              (attempt) =>
                attempt.sequence > traceBeforeRestart.totalAttempts &&
                attempt.clientActionId === action.clientActionId,
            ),
          90_000,
        );
        const next = firstPostRestartAttempt.entries.find(
          (attempt) =>
            attempt.sequence > traceBeforeRestart.totalAttempts &&
            attempt.clientActionId === action.clientActionId,
        );
        assert(
          next.receivedAtUnixMs + clock.offsetMax >= action.nextAttemptAt,
          'Observed retry precedes persisted deadline beyond measured clock uncertainty',
        );
      }
      const delivered = await waitForObservation(
        'eventual delivery of original actions',
        () => inspectNative(context),
        (inspection) =>
          inspection.actions.length === 2 &&
          inspection.actions.every((action) => action.status === 'delivered'),
        180_000,
      );
      assert.deepEqual(
        delivered.actions.map((action) => action.clientActionId),
        before.actions.map((action) => action.clientActionId),
      );
      const server = await fixtureRequest('/__dev/state');
      for (const action of before.actions)
        assert.equal(
          server.receipts.filter(
            (receipt) =>
              receipt.workerId === 'ana' &&
              receipt.clientActionId === action.clientActionId,
          ).length,
          1,
        );
      assert.equal(
        server.acceptances.filter((acceptance) => acceptance.workerId === 'ana')
          .length,
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
      await fixtureRequest('/__dev/failures', {
        latencyMs: 0,
        serverErrorRate: 0,
      });
      await writeFile(
        path.join(output, 'scenario-6.json'),
        JSON.stringify(
          {
            status: 'PASS',
            controls,
            latencyInteraction,
            requirements: ['M1', 'M2', 'M3', 'M5'],
            tests: ['TEST-04'],
            before,
            backoff,
            reopened,
            clock,
            firstPostRestartAttempt,
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
