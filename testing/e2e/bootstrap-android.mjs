import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { readHealthBaseline, verifyNativeHealth } from './native-health.mjs';
import { runMeasurements } from './measurements.mjs';
import { readAndroidMetadata } from './android-metadata.mjs';
import { runReplayJourney } from './replay-journey.mjs';
import { runScenarioOne } from './scenario-one.mjs';
import { runScenarioEight } from './scenario-eight.mjs';
import { runScenarioSeven } from './scenario-seven.mjs';
import { runScenarioSix } from './scenario-six.mjs';
import { runScenarioFive } from './scenario-five.mjs';
import { runScenarioFour } from './scenario-four.mjs';
import { runScenarioThree } from './scenario-three.mjs';
import { runScenarioTwo } from './scenario-two.mjs';
import {
  androidDevice,
  waitForStableAndroidTransport,
} from './android-device.mjs';
import { verifyDeviceDurability } from './device-journey.mjs';
import { runMediaJourney } from './media-journey.mjs';
import { require360DpDisplay } from './display-geometry.mts';

const executeFile = promisify(execFile);
const scenario = process.env.E2E_SCENARIO ?? 'bootstrap';
assert(
  [
    'bootstrap',
    'media-es',
    'media-en',
    'device',
    'measurements',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '2-reboot',
    '3-restart',
    '5-422',
    '6-latency',
    '8-logout',
    'replay-approved',
    'replay-correction',
  ].includes(scenario),
  'Scenario implementation is pending',
);
const briefScenario = /^[1-8]/.test(scenario) ? scenario[0] : null;
for (const [variant, variable] of [
  ['2-reboot', 'E2E_REBOOT_VARIANT'],
  ['3-restart', 'E2E_BACKEND_RESTART'],
  ['6-latency', 'E2E_LATENCY_VARIANT'],
  ['8-logout', 'E2E_LOGOUT_VARIANT'],
])
  if (scenario === variant) process.env[variable] = '1';
if (scenario === '5-422') process.env.E2E_REJECTION = '422';
const applicationId = 'com.cremedigital.seasonalworker.e2e';
const serial = process.env.ANDROID_SERIAL;
assert(
  serial && /^emulator-\d+$/.test(serial),
  'Select a dedicated test emulator',
);
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
assert(sdk, 'ANDROID_HOME is required');
const output = path.resolve(process.env.E2E_OUTPUT ?? 'e2e-results/bootstrap');
const apk = path.resolve(
  process.env.E2E_APK ?? 'e2e-results/temporada-e2e.apk',
);
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
const dataDirectory = await mkdtemp(path.join(tmpdir(), 'temporada-e2e-mock-'));
const result = {
  status: 'FAIL',
  steps: [],
  sourceSha: process.env.GITHUB_SHA ?? 'local',
  virtualCameraBackend: process.env.E2E_CAMERA_BACKEND ?? 'local configuration',
};
let backend;
let originalAirplane;
let originalWifi;
let hasReverse = false;
let protectedBefore;
let originalFontScale;
let originalDisplay;
let originalDensity;
let healthBaseline;
let isCleaningUp = false;
const cancellation = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () =>
    cancellation.abort(new Error(`Run cancelled by ${signal}`)),
  );

async function protectedDataSnapshot() {
  const digest = createHash('sha256');
  async function visit(directory, relative = '') {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      digest.update('absent');
      return;
    }
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const filename = path.join(directory, entry.name);
      const relativeName = path.join(relative, entry.name);
      digest.update(
        JSON.stringify([
          relativeName,
          entry.isDirectory() ? 'directory' : 'file',
        ]),
      );
      if (entry.isDirectory()) await visit(filename, relativeName);
      else if (entry.isSymbolicLink()) digest.update(await readlink(filename));
      else
        for await (const bytes of createReadStream(filename))
          digest.update(bytes);
    }
  }
  await visit(path.resolve('mock-server/.data'));
  return {
    normalMockDigest: digest.digest('hex'),
    ...(process.env.E2E_PROTECTED_FIXTURE === '1'
      ? {
          normalPrivateFixtureDigest: createHash('sha256')
            .update(
              await adb(
                'shell',
                'run-as',
                'com.cremedigital.seasonalworker',
                'cat',
                'files/isolation-sentinel',
              ),
            )
            .digest('hex'),
        }
      : {}),
    normalAppPackage: (
      await adb(
        'shell',
        'pm',
        'list',
        'packages',
        'com.cremedigital.seasonalworker',
      )
    )
      .split('\n')
      .filter((entry) => entry === 'package:com.cremedigital.seasonalworker')
      .join('\n'),
  };
}

async function command(executable, argumentsList) {
  try {
    return (
      await executeFile(executable, argumentsList, {
        timeout: 180_000,
        signal: isCleaningUp ? undefined : cancellation.signal,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          ...process.env,
          TZ: 'UTC',
          MAESTRO_CLI_NO_ANALYTICS: '1',
          MAESTRO_DRIVER_STARTUP_TIMEOUT: '60000',
        },
      })
    ).stdout.trim();
  } catch (error) {
    throw new Error(
      [
        String(error),
        `exit=${error.code ?? 'none'} signal=${error.signal ?? 'none'} killed=${error.killed ?? false}`,
        error.stdout,
        error.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}
const adb = (...argumentsList) =>
  command(path.join(sdk, 'platform-tools/adb'), [
    '-s',
    serial,
    ...argumentsList,
  ]);
const flowCounts = new Map();
let hasReadyDriver = false;
const flow = async (name, parameters = {}) => {
  await adb('wait-for-device');
  assert.equal(
    await adb('get-state'),
    'device',
    'Emulator ADB transport is not ready',
  );
  if (!hasReadyDriver)
    await step('stable-driver-transport', () =>
      waitForStableAndroidTransport(adb),
    );
  if (hasReverse && !(await adb('reverse', '--list')).includes('tcp:3101'))
    await adb('reverse', 'tcp:3101', 'tcp:3101');
  parameters = {
    WORKER_ID: briefScenario === '7' ? 'carla' : 'ana',
    WORKER_NAME: briefScenario === '7' ? '.*Carla Díaz.*' : '.*Ana López.*',
    ...parameters,
  };
  const invocation = (flowCounts.get(name) ?? 0) + 1;
  flowCounts.set(name, invocation);
  const artifactName = `${name}-${invocation}`;
  hasReadyDriver = false;
  const stdout = await command(process.env.MAESTRO_BINARY ?? 'maestro', [
    '--device',
    serial,
    'test',
    '--format',
    'junit',
    '--output',
    path.join(output, `${artifactName}.xml`),
    '--test-output-dir',
    path.join(output, artifactName),
    ...Object.entries(parameters).flatMap(([key, value]) => [
      '-e',
      `${key}=${value}`,
    ]),
    `.maestro/${name}.yaml`,
  ]);
  hasReadyDriver = true;
  return { stdout, artifactDirectory: path.join(output, artifactName) };
};

async function step(name, operation) {
  try {
    if (!isCleaningUp) cancellation.signal.throwIfAborted();
    result.steps.push({ name, status: 'PASS', detail: await operation() });
    console.log(`PASS ${name}`);
  } catch (error) {
    result.steps.push({ name, status: 'FAIL', error: String(error) });
    throw error;
  }
}

async function stopBackend() {
  if (!backend || backend.exitCode !== null || backend.signalCode !== null)
    return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => backend.kill('SIGKILL'), 5000);
    backend.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    backend.kill('SIGTERM');
  });
}

async function startBackend() {
  backend = spawn(
    process.execPath,
    ['--experimental-strip-types', 'mock-server/src/server.ts'],
    {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MOCK_PORT: '3101',
        MOCK_DATA_DIR: dataDirectory,
        MOCK_ENABLE_CONTROLS: '1',
      },
      stdio: 'ignore',
    },
  );
  let startupError;
  backend.once('error', (error) => {
    startupError = error;
  });
  const deadline = Date.now() + 15_000;
  while (true) {
    if (startupError) throw startupError;
    assert(backend.exitCode === null, 'Owned backend exited during startup');
    try {
      const response = await fetch('http://127.0.0.1:3101/health', {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
    assert(Date.now() < deadline, 'Mock readiness deadline exceeded');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
async function restartBackend() {
  await stopBackend();
  await startBackend();
}

try {
  originalAirplane = await adb(
    'shell',
    'settings',
    'get',
    'global',
    'airplane_mode_on',
  );
  originalWifi = await adb('shell', 'settings', 'get', 'global', 'wifi_on');
  originalFontScale = await adb(
    'shell',
    'settings',
    'get',
    'system',
    'font_scale',
  );
  if (process.env.E2E_LAYOUT_VARIANT === '1') {
    originalDisplay = await adb('shell', 'wm', 'size');
    originalDensity = await adb('shell', 'wm', 'density');
    await step('layout-360dp-130-percent', async () => {
      const widthDp = require360DpDisplay(originalDisplay, originalDensity);
      await adb('shell', 'settings', 'put', 'system', 'font_scale', '1.3');
      const fontScale = await adb(
        'shell',
        'settings',
        'get',
        'system',
        'font_scale',
      );
      assert.equal(Number(fontScale), 1.3);
      return {
        widthDp,
        fontScale: Number(fontScale),
        display: await adb('shell', 'wm', 'size'),
        density: await adb('shell', 'wm', 'density'),
      };
    });
  }
  await step('device-and-toolchain-identity', () =>
    readAndroidMetadata({ adb, command, sdk }),
  );
  healthBaseline = await readHealthBaseline(adb);
  await step('protected-normal-data-baseline', async () => {
    protectedBefore = await protectedDataSnapshot();
    return {
      normalAppInstalled: protectedBefore.normalAppPackage
        .split('\n')
        .includes('package:com.cremedigital.seasonalworker'),
      normalMockDigest: protectedBefore.normalMockDigest,
      normalPrivateFixtureDigest:
        protectedBefore.normalPrivateFixtureDigest ?? null,
    };
  });
  await step('isolated-bundled-apk', async () => {
    const metadata = JSON.parse(await readFile(`${apk}.json`, 'utf8'));
    assert.equal(metadata.applicationId, applicationId);
    assert.equal(
      createHash('sha256')
        .update(await readFile(apk))
        .digest('hex'),
      metadata.sha256,
      'APK hash does not match its build record',
    );
    const badging = await command(path.join(sdk, 'build-tools/37.0.0/aapt'), [
      'dump',
      'badging',
      apk,
    ]);
    assert(
      badging.includes(`package: name='${applicationId}'`),
      'Wrong native APK identity',
    );
    assert(
      !badging.includes('application-debuggable'),
      'E2E proof requires bundled release mode',
    );
    const entries = await command('unzip', ['-Z1', apk]);
    assert(
      entries.split('\n').includes('assets/index.android.bundle'),
      'No bundled JavaScript',
    );
    const installed = await adb(
      'shell',
      'pm',
      'list',
      'packages',
      applicationId,
    );
    if (installed.split('\n').includes(`package:${applicationId}`))
      await adb('uninstall', applicationId);
    await adb('install', apk);
    return metadata;
  });
  await step('isolated-backend', async () => {
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', reject);
      probe.listen(3101, '127.0.0.1', () => probe.close(resolve));
    });
    const mappings = await adb('reverse', '--list');
    assert(
      !mappings.includes('tcp:3101'),
      'Existing ADB reverse mapping must remain untouched',
    );
    await startBackend();
    await adb('reverse', 'tcp:3101', 'tcp:3101');
    hasReverse = true;
    const fixtureResponse = await fetch('http://127.0.0.1:3101/__dev/state', {
      signal: AbortSignal.timeout(1000),
    });
    assert.equal(fixtureResponse.status, 200);
    await writeFile(
      path.join(output, 'initial-fixture.json'),
      JSON.stringify(await fixtureResponse.json(), null, 2),
    );
    await flow('probe-airplane-off');
    await adb('shell', 'svc', 'wifi', 'enable');
    return { port: 3101, temporaryData: true };
  });
  if (briefScenario === '1')
    await step('Spanish-default-before-authentication', () =>
      flow('auth-default-spanish'),
    );
  await step('authenticate-and-cache-home', () =>
    flow(briefScenario === '7' ? 'shared-sign-in' : 'bootstrap-sign-in'),
  );
  if (scenario === 'measurements') {
    await step('Android-9-cold-launch-and-PSS-measurements', () =>
      runMeasurements({ adb, flow, output, temporaryDirectory: dataDirectory }),
    );
  } else if (scenario.startsWith('replay-')) {
    await step('TEST-03R-newer-review-before-old-receipt', () =>
      runReplayJourney(
        { adb, flow, output, temporaryDirectory: dataDirectory },
        scenario === 'replay-approved' ? 'approved' : 'correction_requested',
      ),
    );
  } else if (briefScenario === '1') {
    await step('brief-1-language-persistence-and-localized-feedback', () =>
      runScenarioOne({ adb, flow, output, temporaryDirectory: dataDirectory }),
    );
  } else if (briefScenario === '8') {
    await step('brief-8-expiry-reauthentication-and-pending-work', () =>
      runScenarioEight({
        adb,
        flow,
        output,
        temporaryDirectory: dataDirectory,
      }),
    );
  } else if (briefScenario === '7') {
    await step('brief-7-shared-phone-correction-isolation', () =>
      runScenarioSeven({
        adb,
        flow,
        output,
        temporaryDirectory: dataDirectory,
      }),
    );
  } else if (briefScenario === '6') {
    await step('brief-6-persisted-backoff-and-responsive-ui', () =>
      runScenarioSix({ adb, flow, output, temporaryDirectory: dataDirectory }),
    );
  } else if (briefScenario === '5') {
    await step('brief-5-permanent-rejection-and-explicit-retake', () =>
      runScenarioFive({ adb, flow, output, temporaryDirectory: dataDirectory }),
    );
  } else if (briefScenario === '4') {
    await step('brief-4-stale-terms-and-explicit-new-confirmation', () =>
      runScenarioFour({ adb, flow, output }),
    );
  } else if (briefScenario === '3') {
    await step('brief-3-committed-drop-and-replay', () =>
      runScenarioThree({
        adb,
        flow,
        output,
        temporaryDirectory: dataDirectory,
        restartBackend,
      }),
    );
  } else if (briefScenario === '2') {
    await step('brief-2-offline-terms-camera-restart-reconnect', () =>
      runScenarioTwo({ adb, flow, output, temporaryDirectory: dataDirectory }),
    );
  } else if (scenario.startsWith('media-') || scenario === 'device') {
    await step('native-camera-gallery-and-private-storage', () =>
      runMediaJourney({
        adb,
        flow,
        output,
        temporaryDirectory: dataDirectory,
        language: scenario === 'media-en' ? 'en' : 'es',
        beforeCapture:
          process.env.E2E_LAYOUT_VARIANT === '1'
            ? ({ translations }) =>
                flow('layout-screens', {
                  GREETING_LABEL: translations.ui.greeting.replace(
                    '{{name}}',
                    'Ana López',
                  ),
                  TERMS_TITLE: translations.reference.beforeBegin,
                  DOCUMENTS_TITLE: translations.documents.title,
                })
            : undefined,
        afterSave:
          scenario === 'device'
            ? (before) => verifyDeviceDurability({ adb, flow, output, before })
            : undefined,
      }),
    );
  } else
    await step('offline-force-stop-without-backend-or-metro', async () => {
      await adb('shell', 'am', 'force-stop', applicationId);
      await stopBackend();
      await flow('probe-airplane');
      await adb('shell', 'svc', 'wifi', 'disable');
      assert.equal(
        await adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'),
        '1',
      );
      assert.equal(
        await adb('shell', 'settings', 'get', 'global', 'wifi_on'),
        '0',
      );
      return flow('bootstrap-offline');
    });
  await step('no-unexpected-application-crash-or-ANR', () =>
    verifyNativeHealth(adb, healthBaseline),
  );
  result.status = 'PASS';
} catch (error) {
  result.error = String(error);
  process.exitCode = 1;
  console.error(error);
  if (backend && backend.exitCode === null && backend.signalCode === null) {
    for (const control of ['state', 'trace', 'replays']) {
      try {
        const response = await fetch(`http://127.0.0.1:3101/__dev/${control}`, {
          signal: AbortSignal.timeout(1000),
        });
        assert.equal(response.status, 200);
        await writeFile(
          path.join(output, `failure-${control}.json`),
          JSON.stringify(await response.json(), null, 2),
        );
      } catch (diagnosticError) {
        result.steps.push({
          name: `collect-failure-${control}`,
          status: 'FAIL',
          error: String(diagnosticError),
        });
      }
    }
  }
} finally {
  isCleaningUp = true;
  for (const [name, cleanup] of [
    ['stop-owned-backend', stopBackend],
    [
      'restore-display-size',
      async () => {
        if (originalDisplay !== undefined)
          await adb(
            'shell',
            'wm',
            'size',
            /Override size: (\d+x\d+)/.exec(originalDisplay)?.[1] ?? 'reset',
          );
      },
    ],
    [
      'restore-display-density',
      async () => {
        if (originalDensity !== undefined)
          await adb(
            'shell',
            'wm',
            'density',
            /Override density: (\d+)/.exec(originalDensity)?.[1] ?? 'reset',
          );
      },
    ],
    [
      'restore-device-settings',
      async () => {
        if (
          originalAirplane !== undefined &&
          originalWifi !== undefined &&
          originalFontScale !== undefined
        )
          await androidDevice({ adb, flow }).restore({
            airplane: originalAirplane,
            wifi: originalWifi,
            fontScale: originalFontScale,
          });
      },
    ],
    [
      'remove-owned-reverse',
      async () => {
        if (hasReverse) await adb('reverse', '--remove', 'tcp:3101');
      },
    ],
    [
      'remove-temporary-fixtures',
      () => rm(dataDirectory, { recursive: true, force: true }),
    ],
    [
      'verify-protected-normal-data',
      async () => {
        if (!protectedBefore)
          throw new Error('Protected-data baseline unavailable');
        const protectedAfter = await protectedDataSnapshot();
        assert.deepEqual(
          protectedAfter,
          protectedBefore,
          'Normal app package or mock data changed during E2E execution',
        );
        return { unchanged: true, ...protectedAfter };
      },
    ],
  ]) {
    try {
      await step(name, cleanup);
    } catch (error) {
      result.status = 'FAIL';
      process.exitCode = 1;
      console.error(error);
    }
  }
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(result, null, 2),
  );
}
