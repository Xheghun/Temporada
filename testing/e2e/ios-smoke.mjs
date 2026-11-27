import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

assert.equal(process.platform, 'darwin');
const execute = promisify(execFile);
const output = path.resolve(process.env.E2E_OUTPUT ?? 'e2e-results/ios-smoke');
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
const temporary = await mkdtemp(path.join(tmpdir(), 'temporada-ios-smoke-'));
const archive = path.resolve(
  process.env.E2E_IOS_ARCHIVE ?? 'e2e-results/temporada-e2e-ios.tar.gz',
);
const report = {
  status: 'FAIL',
  sourceSha: process.env.GITHUB_SHA ?? 'local',
  subset: [
    'Ana sign-in',
    'Spanish default',
    'English navigation',
    'English preference after termination',
    'shared-phone selection and switch',
  ],
  excluded: [
    'Android airplane-mode checks',
    'document capture and upload failure scenarios',
    'spoken VoiceOver listening',
  ],
  steps: [],
};
let simulator;
let backend;
let isCleaningUp = false;
const cancellation = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => cancellation.abort());
const command = async (executable, parameters) =>
  (
    await execute(executable, parameters, {
      timeout: 600_000,
      signal: isCleaningUp ? undefined : cancellation.signal,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        MAESTRO_CLI_NO_ANALYTICS: '1',
        MAESTRO_DRIVER_STARTUP_TIMEOUT: '240000',
      },
    })
  ).stdout.trim();
const simctl = (...parameters) => command('xcrun', ['simctl', ...parameters]);
async function step(name, operation) {
  try {
    if (!isCleaningUp) cancellation.signal.throwIfAborted();
    const detail = await operation();
    report.steps.push({ name, status: 'PASS', detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.steps.push({ name, status: 'FAIL', error: String(error) });
    console.error(`FAIL ${name}: ${String(error)}`);
    throw error;
  }
}
const flow = (name) =>
  command(process.env.MAESTRO_BINARY ?? 'maestro', [
    '--device',
    simulator,
    'test',
    '--format',
    'junit',
    '--output',
    path.join(output, `${name}.xml`),
    '--test-output-dir',
    path.join(output, name),
    `.maestro/${name}.yaml`,
  ]);
try {
  await step('isolated-bundled-simulator-build', async () => {
    const metadata = JSON.parse(await readFile(`${archive}.json`, 'utf8'));
    assert.equal(metadata.applicationId, 'com.cremedigital.seasonalworker.e2e');
    assert.equal(metadata.keychainAccessGroup, metadata.applicationId);
    assert.equal(metadata.metroRequired, false);
    assert.equal(
      createHash('sha256')
        .update(await readFile(archive))
        .digest('hex'),
      metadata.sha256,
    );
    await command('tar', ['-xzf', archive, '-C', temporary]);
    return metadata;
  });
  await step('owned-simulator-and-toolchain', async () => {
    const toolchain = JSON.parse(
      await readFile('testing/e2e/toolchain.json', 'utf8'),
    );
    const maestro = await command(process.env.MAESTRO_BINARY ?? 'maestro', [
      '--version',
    ]);
    assert(maestro.includes(toolchain.maestro.version));
    const runtimes = JSON.parse(await simctl('list', 'runtimes', '-j'))
      .runtimes.filter(
        (runtime) =>
          runtime.isAvailable && runtime.identifier.includes('.iOS-'),
      )
      .sort((left, right) =>
        right.version.localeCompare(left.version, undefined, { numeric: true }),
      );
    assert(runtimes.length, 'No available iOS runtime');
    const runtime = runtimes[0];
    const deviceTypes =
      runtime.supportedDeviceTypes ??
      JSON.parse(await simctl('list', 'devicetypes', '-j')).devicetypes;
    const deviceType =
      deviceTypes.find((device) => device.name === 'iPhone 16') ??
      deviceTypes.find((device) => device.productFamily === 'iPhone');
    assert(deviceType, 'No compatible iPhone device type');
    simulator = await simctl(
      'create',
      `Temporada E2E ${Date.now()}`,
      deviceType.identifier,
      runtime.identifier,
    );
    assert(/^[0-9a-f-]{36}$/i.test(simulator));
    await simctl('boot', simulator);
    await simctl('bootstatus', simulator, '-b');
    const apps = (await readdir(temporary)).filter((name) =>
      name.endsWith('.app'),
    );
    assert.equal(apps.length, 1);
    const app = path.join(temporary, apps[0]);
    assert.equal(
      await command('/usr/libexec/PlistBuddy', [
        '-c',
        'Print:CFBundleIdentifier',
        path.join(app, 'Info.plist'),
      ]),
      'com.cremedigital.seasonalworker.e2e',
    );
    assert((await readFile(path.join(app, 'main.jsbundle'))).length > 0);
    const entitlements = await command('/usr/bin/codesign', [
      '--display',
      '--entitlements',
      '-',
      '--xml',
      app,
    ]);
    assert(entitlements.includes('<key>keychain-access-groups</key>'));
    assert(entitlements.includes('com.cremedigital.seasonalworker.e2e'));
    await simctl('install', simulator, app);
    return {
      simulator,
      runtime: {
        identifier: runtime.identifier,
        version: runtime.version,
        build: runtime.buildversion,
      },
      deviceType: deviceType.identifier,
      maestro,
      xcode: await command('xcodebuild', ['-version']),
      hostArchitecture: process.arch,
    };
  });
  await step('owned-fixture-backend', async () => {
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', reject);
      probe.listen(3101, '127.0.0.1', () => probe.close(resolve));
    });
    backend = spawn(
      process.execPath,
      ['--experimental-strip-types', 'mock-server/src/server.ts'],
      {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          MOCK_ENABLE_CONTROLS: '1',
          MOCK_PORT: '3101',
          MOCK_DATA_DIR: path.join(temporary, 'mock'),
        },
        stdio: 'ignore',
      },
    );
    const deadline = Date.now() + 15000;
    while (true) {
      assert.equal(backend.exitCode, null, 'Owned backend exited');
      try {
        const response = await fetch('http://127.0.0.1:3101/health', {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) break;
      } catch (error) {
        if (Date.now() >= deadline) throw error;
      }
      assert(Date.now() < deadline, 'Backend readiness deadline exceeded');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });
  await step('Ana-sign-in-and-Spanish', async () => {
    await flow('bootstrap-sign-in');
    await flow('language-spanish');
  });
  await step('English-and-primary-navigation', () =>
    flow('ios-english-navigation'),
  );
  await step('persisted-language-after-termination', async () => {
    await simctl('terminate', simulator, 'com.cremedigital.seasonalworker.e2e');
    await flow('ios-reopen');
  });
  await step('shared-phone-selection-and-switch', () =>
    flow('ios-shared-phone'),
  );
  report.status = 'PASS';
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
} finally {
  isCleaningUp = true;
  for (const [name, cleanup] of [
    [
      'stop-owned-backend',
      async () => {
        if (backend && backend.exitCode === null)
          await new Promise((resolve) => {
            const timer = setTimeout(() => backend.kill('SIGKILL'), 5000);
            backend.once('exit', () => {
              clearTimeout(timer);
              resolve();
            });
            backend.kill('SIGTERM');
          });
      },
    ],
    [
      'delete-owned-simulator',
      async () => {
        if (simulator) {
          try {
            await simctl('shutdown', simulator);
          } finally {
            await simctl('delete', simulator);
          }
        }
      },
    ],
    [
      'remove-owned-temporary-files',
      () => rm(temporary, { recursive: true, force: true }),
    ],
  ]) {
    try {
      await step(name, cleanup);
    } catch {
      report.status = 'FAIL';
      process.exitCode = 1;
    }
  }
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(report, null, 2),
  );
}
