import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
const toolchain = JSON.parse(
  await readFile(new URL('./toolchain.json', import.meta.url), 'utf8'),
);
const serial = process.env.ANDROID_SERIAL;
const api = process.env.PROBE_API;
const image = toolchain.android.images[api];
assert(serial && /^emulator-\d+$/.test(serial), 'Select a dedicated emulator');
assert(image, 'PROBE_API must be 28 or 34');
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
assert(sdk, 'ANDROID_HOME is required');
const maestro = process.env.MAESTRO_BINARY ?? 'maestro';
const output = path.resolve(process.env.PROBE_OUTPUT ?? 'e2e-results/probe');
await mkdir(output, { recursive: true });
const report = {
  sourceSha: process.env.GITHUB_SHA ?? 'local',
  host: `${process.platform}/${process.arch}`,
  api,
  serial,
  status: 'FAIL',
  steps: [],
};

async function command(executable, argumentsList) {
  const result = await executeFile(executable, argumentsList, {
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1' },
  });
  return `${result.stdout}${result.stderr}`.trim();
}

const adb = (...argumentsList) =>
  command(path.join(sdk, 'platform-tools/adb'), [
    '-s',
    serial,
    ...argumentsList,
  ]);

async function step(name, operation) {
  try {
    const detail = await operation();
    report.steps.push({ name, status: 'PASS', detail });
    console.log(`PASS ${name}`);
    return detail;
  } catch (error) {
    report.steps.push({ name, status: 'FAIL', error: String(error) });
    throw error;
  } finally {
    await writeFile(
      path.join(output, 'result.json'),
      JSON.stringify(report, null, 2),
    );
  }
}

async function flow(filename) {
  return command(maestro, [
    '--device',
    serial,
    'test',
    '--format',
    'junit',
    '--output',
    path.join(output, `${filename}.xml`),
    '--debug-output',
    path.join(output, `${filename}-debug`),
    '-e',
    `PROBE_OUTPUT=${output}`,
    `.maestro/${filename}.yaml`,
  ]);
}

let originalAirplane;
let originalWifi;
try {
  originalAirplane = await adb(
    'shell',
    'settings',
    'get',
    'global',
    'airplane_mode_on',
  );
  originalWifi = await adb('shell', 'settings', 'get', 'global', 'wifi_on');
  await step('pinned-toolchain', async () => {
    const version = await command(maestro, ['--version']);
    assert(
      version.includes(toolchain.maestro.version),
      `Unexpected Maestro: ${version}`,
    );
    const emulator = await readFile(
      path.join(sdk, 'emulator/source.properties'),
      'utf8',
    );
    assert(
      emulator.includes(`Pkg.Revision=${toolchain.android.emulatorVersion}`),
      emulator,
    );
    const systemImage = await readFile(
      path.join(
        sdk,
        `system-images/android-${api}/${image.target}/${image.abi}/source.properties`,
      ),
      'utf8',
    );
    assert.match(
      systemImage,
      new RegExp(`Pkg.Revision\\s*=\\s*${image.revision}(?:\\.0)?\\s*$`, 'm'),
    );
    return {
      maestro: version,
      emulator,
      systemImage,
      platformTools: await command(path.join(sdk, 'platform-tools/adb'), [
        'version',
      ]),
    };
  });
  await step('target-identity-and-memory', async () => {
    assert.equal(await adb('shell', 'getprop', 'ro.build.version.sdk'), api);
    assert.equal(
      await adb('shell', 'getprop', 'ro.product.cpu.abi'),
      image.abi,
    );
    const avd = (await adb('emu', 'avd', 'name')).split('\n')[0].trim();
    assert(/^[\w-]+$/.test(avd), 'Invalid AVD name');
    const avdRoot =
      process.env.ANDROID_AVD_HOME ?? path.join(homedir(), '.android/avd');
    const configuration = await readFile(
      path.join(avdRoot, `${avd}.avd/config.ini`),
      'utf8',
    );
    assert.match(configuration, /^hw.ramSize\s*=\s*2048\s*$/m);
    const memory = await adb('shell', 'cat', '/proc/meminfo');
    const observedKiB = Number(/^MemTotal:\s+(\d+) kB/m.exec(memory)?.[1]);
    assert(
      observedKiB > 1_500_000 && observedKiB <= 2_097_152,
      `Unexpected guest RAM: ${observedKiB}`,
    );
    return {
      avd,
      configuration,
      observedKiB,
      properties: await adb('shell', 'getprop'),
      memory,
    };
  });
  await step('native-selection-screenshot-and-restart', () =>
    flow('probe-driver'),
  );
  await step('airplane-and-wifi-off', async () => {
    const driverOutput = await flow('probe-airplane');
    await adb('shell', 'svc', 'wifi', 'disable');
    assert.equal(
      await adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'),
      '1',
    );
    assert.equal(
      await adb('shell', 'settings', 'get', 'global', 'wifi_on'),
      '0',
    );
    return driverOutput;
  });
  report.status = 'PASS';
} catch (error) {
  report.error = String(error);
  process.exitCode = 1;
  console.error(error);
} finally {
  await step('restore-connectivity', async () => {
    if (originalAirplane !== undefined) {
      await adb(
        'shell',
        'settings',
        'put',
        'global',
        'airplane_mode_on',
        originalAirplane,
      );
      await adb(
        'shell',
        'am',
        'broadcast',
        '-a',
        'android.intent.action.AIRPLANE_MODE',
        '--ez',
        'state',
        originalAirplane === '1' ? 'true' : 'false',
      );
    }
    if (originalWifi !== undefined) {
      await adb(
        'shell',
        'svc',
        'wifi',
        originalWifi === '0' ? 'disable' : 'enable',
      );
    }
    return { airplane: originalAirplane, wifi: originalWifi };
  }).catch((error) => {
    report.status = 'FAIL';
    report.cleanupError = String(error);
    process.exitCode = 1;
  });
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify(report, null, 2),
  );
}
