import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
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
const dataDirectory = await mkdtemp(path.join(tmpdir(), 'temporada-e2e-mock-'));
await mkdir(output, { recursive: true });
const result = {
  status: 'FAIL',
  steps: [],
  sourceSha: process.env.GITHUB_SHA ?? 'local',
};
let backend;
let originalAirplane;
let originalWifi;
let hasReverse = false;

async function command(executable, argumentsList) {
  try {
    return (
      await executeFile(executable, argumentsList, {
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1' },
      })
    ).stdout.trim();
  } catch (error) {
    throw new Error(
      [String(error), error.stdout, error.stderr].filter(Boolean).join('\n'),
    );
  }
}
const adb = (...argumentsList) =>
  command(path.join(sdk, 'platform-tools/adb'), [
    '-s',
    serial,
    ...argumentsList,
  ]);
const flow = (name) =>
  command(process.env.MAESTRO_BINARY ?? 'maestro', [
    '--device',
    serial,
    'test',
    '--format',
    'junit',
    '--output',
    path.join(output, `${name}.xml`),
    '--test-output-dir',
    path.join(output, name),
    `.maestro/${name}.yaml`,
  ]);

async function step(name, operation) {
  try {
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

try {
  originalAirplane = await adb(
    'shell',
    'settings',
    'get',
    'global',
    'airplane_mode_on',
  );
  originalWifi = await adb('shell', 'settings', 'get', 'global', 'wifi_on');
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
    await adb('reverse', 'tcp:3101', 'tcp:3101');
    hasReverse = true;
    await flow('probe-airplane-off');
    await adb('shell', 'svc', 'wifi', 'enable');
    return { port: 3101, temporaryData: true };
  });
  await step('authenticate-and-cache-home', () => flow('bootstrap-sign-in'));
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
  result.status = 'PASS';
} catch (error) {
  result.error = String(error);
  process.exitCode = 1;
  console.error(error);
} finally {
  for (const [name, cleanup] of [
    ['stop-owned-backend', stopBackend],
    [
      'restore-airplane',
      async () => {
        if (originalAirplane !== undefined)
          await flow(
            originalAirplane === '1' ? 'probe-airplane' : 'probe-airplane-off',
          );
      },
    ],
    [
      'restore-wifi',
      async () => {
        if (originalWifi !== undefined)
          await adb(
            'shell',
            'svc',
            'wifi',
            originalWifi === '0' ? 'disable' : 'enable',
          );
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
