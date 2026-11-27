import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
const serial = process.env.ANDROID_SERIAL;
assert(
  sdk && serial && /^emulator-\d+$/.test(serial),
  'Select a dedicated emulator',
);
const adb = async (...parameters) =>
  (
    await execute(
      path.join(sdk, 'platform-tools/adb'),
      ['-s', serial, ...parameters],
      { timeout: 30_000 },
    )
  ).stdout.trim();
const settings = async () => ({
  airplane: await adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'),
  wifi: await adb('shell', 'settings', 'get', 'global', 'wifi_on'),
  fontScale: await adb('shell', 'settings', 'get', 'system', 'font_scale'),
});
const before = await settings();
const output = path.resolve(
  process.env.E2E_OUTPUT ?? 'e2e-results/intentional-failure',
);
const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['testing/e2e/bootstrap-android.mjs'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_OUTPUT: output,
      E2E_SCENARIO: 'device',
      E2E_INJECT_FAILURE: 'after-offline',
    },
  });
  child.once('error', reject);
  child.once('exit', (code) => resolve(code));
});
assert.equal(
  exitCode,
  1,
  'An intentionally failed assertion must exit with failure',
);
const report = JSON.parse(
  await readFile(path.join(output, 'result.json'), 'utf8'),
);
assert.equal(report.status, 'FAIL');
assert.match(report.error, /intentional_failure_after_offline/);
for (const name of [
  'stop-owned-backend',
  'restore-device-settings',
  'remove-owned-reverse',
  'remove-temporary-fixtures',
  'verify-protected-normal-data',
]) {
  const step = report.steps.find((step) => step.name === name);
  assert.equal(step?.status, 'PASS', `Cleanup failed or missing: ${name}`);
}
assert.deepEqual(
  await settings(),
  before,
  'Failed flow did not restore settings',
);
assert(
  !(await adb('reverse', '--list')).includes('tcp:3101'),
  'Owned forwarding remains',
);
let backendStopped = false;
try {
  await fetch('http://127.0.0.1:3101/health', {
    signal: AbortSignal.timeout(1000),
  });
} catch {
  backendStopped = true;
}
assert(backendStopped, 'Owned mock backend remains running');
await writeFile(
  path.join(output, 'cleanup-verification.json'),
  JSON.stringify(
    {
      status: 'PASS',
      expectedJourneyStatus: 'FAIL',
      exitCode,
      restoredSettings: before,
      backendStopped,
    },
    null,
    2,
  ),
);
