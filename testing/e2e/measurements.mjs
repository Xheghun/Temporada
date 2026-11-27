import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { runMediaJourney } from './media-journey.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';

const applicationId = 'com.cremedigital.seasonalworker.e2e';
export async function runMeasurements(context) {
  const { adb, flow, output } = context;
  assert.equal(
    await adb('shell', 'getprop', 'ro.build.version.sdk'),
    '28',
    'Low-end measurements require Android 9',
  );
  const device = androidDevice(context);
  const samples = [];
  const samplingErrors = [];
  let phase = 'idle';
  let isSampling = true;
  const sample = async () => {
    const memory = await adb('shell', 'dumpsys', 'meminfo', applicationId);
    const pssKiB = Number(
      /TOTAL PSS:\s+(\d+)/.exec(memory)?.[1] ??
        /^\s*TOTAL\s+(\d+)\s+\d+/m.exec(memory)?.[1],
    );
    samples.push({
      timestamp: Date.now(),
      phase,
      pssKiB: Number.isFinite(pssKiB) ? pssKiB : null,
      processPresent: Number.isFinite(pssKiB),
    });
  };
  const sampler = (async () => {
    while (isSampling) {
      try {
        await sample();
      } catch (error) {
        samplingErrors.push(String(error));
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  })();
  const launchMeasurements = [];
  const diagnosticsBefore = await adb(
    'logcat',
    '-b',
    'crash',
    '-d',
    '-v',
    'brief',
  );
  let durable;
  let delivered;
  try {
    await sample();
    await runMediaJourney({
      ...context,
      language: 'es',
      async beforeCapture() {
        phase = 'native-capture-and-compression';
      },
      async afterSave(before) {
        durable = before;
        phase = 'restart';
        for (let repetition = 1; repetition <= 5; repetition++) {
          await device.forceStop();
          const started = performance.now();
          const activityTiming = await adb(
            'shell',
            'am',
            'start',
            '-W',
            '-n',
            `${applicationId}/.MainActivity`,
          );
          assert.match(activityTiming, /Status: ok/);
          await flow('device-home');
          const homeObservedMs = performance.now() - started;
          const after = await inspectNative(context);
          assert.deepEqual(
            after.actions,
            before.actions,
            'Process-cold launch lost pending actions or private bytes',
          );
          launchMeasurements.push({
            repetition,
            activityTiming,
            homeObservedMs,
            actionIds: after.actions.map((action) => action.clientActionId),
          });
        }
        phase = 'reconnect';
        await device.online();
        delivered = await waitForObservation(
          'measurement queue delivery',
          () => inspectNative(context),
          (inspection) =>
            inspection.actions.length === 2 &&
            inspection.actions.every((action) => action.status === 'delivered'),
        );
      },
    });
  } finally {
    isSampling = false;
    await sampler;
    await writeFile(
      path.join(output, 'memory-samples.json'),
      JSON.stringify(
        {
          intervalMs: 1000,
          scheduling:
            'one second after each completed dumpsys; actual timestamps retained',
          samples,
          errors: samplingErrors,
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(output, 'cold-launches.json'),
      JSON.stringify(
        {
          method:
            'Five force-stop launches after authenticated cache setup. am start -W is native activity timing. Home observation includes Maestro startup/polling overhead.',
          launches: launchMeasurements,
        },
        null,
        2,
      ),
    );
  }
  assert.equal(launchMeasurements.length, 5);
  assert.equal(samplingErrors.length, 0, 'PSS sampler failed');
  for (const requiredPhase of [
    'idle',
    'native-capture-and-compression',
    'restart',
    'reconnect',
  ])
    assert(
      samples.some(
        (sample) => sample.phase === requiredPhase && sample.pssKiB > 0,
      ),
      `Missing PSS samples: ${requiredPhase}`,
    );
  const crashLog = await adb('logcat', '-b', 'crash', '-d', '-v', 'brief');
  const newCrashLines = crashLog
    .split('\n')
    .filter(
      (line) =>
        line.includes(applicationId) && !diagnosticsBefore.includes(line),
    );
  const lastAnr = await adb('shell', 'dumpsys', 'activity', 'lastanr');
  assert.equal(
    newCrashLines.length,
    0,
    'Unexpected app crash in measurement run',
  );
  assert(
    !lastAnr.includes(applicationId),
    'App ANR recorded in measurement run',
  );
  const phases = Object.fromEntries(
    ['idle', 'native-capture-and-compression', 'restart', 'reconnect'].map(
      (name) => [
        name,
        Math.max(
          ...samples
            .filter((sample) => sample.phase === name && sample.pssKiB !== null)
            .map((sample) => sample.pssKiB),
        ),
      ],
    ),
  );
  await writeFile(
    path.join(output, 'measurements.json'),
    JSON.stringify(
      {
        status: 'PASS',
        launchMeasurements,
        sampledMaximumPssKiB: Math.max(...Object.values(phases)),
        sampledMaximumByPhaseKiB: phases,
        crashes: newCrashLines.length,
        anr: false,
        durable,
        delivered,
        server: await fixtureRequest('/__dev/state'),
        buildOverhead:
          'Bundled release E2E identity with read-only inspection and fixture flags enabled. Home readiness includes driver startup; PSS is sampled rather than a peak profiler measurement. No performance SLA is applied.',
      },
      null,
      2,
    ),
  );
}
