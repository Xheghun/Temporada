import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

const mode = process.env.E2E_SUITE ?? 'smoke';
assert(
  [
    'foundation',
    'smoke',
    'full',
    'acceptance',
    'scenario',
    'intentional-failure',
  ].includes(mode),
  'Unknown CI suite',
);
const output = path.resolve(process.env.E2E_OUTPUT ?? 'e2e-results/native');
await mkdir(output, { recursive: true });
const groups = [];
const run = async (name, script, parameters = [], extraEnvironment = {}) => {
  const groupOutput = path.join(output, name);
  const startedAt = new Date().toISOString();
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...parameters], {
      stdio: 'inherit',
      env: { ...process.env, ...extraEnvironment, E2E_OUTPUT: groupOutput },
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? signal));
  });
  groups.push({
    name,
    status: exitCode === 0 ? 'PASS' : 'FAIL',
    exitCode,
    output: name,
    startedAt,
    completedAt: new Date().toISOString(),
  });
};
const suite = (name, parameters = [], extraEnvironment = {}) =>
  run(name, 'testing/e2e/run.mts', parameters, extraEnvironment);
try {
  if (mode === 'foundation') {
    await suite('media', ['--suite', 'media']);
    await suite('bootstrap', ['--suite', 'bootstrap', '--repeat', '2']);
    await suite('device', ['--suite', 'device']);
    await run('failed-cleanup', 'testing/e2e/verify-failed-cleanup.mjs');
  } else if (mode === 'scenario') {
    await suite('individual', [
      '--scenario',
      process.env.E2E_SELECTED_SCENARIO ?? '2',
    ]);
  } else if (mode === 'intentional-failure') {
    await run('intentional-failure', 'testing/e2e/bootstrap-android.mjs', [], {
      E2E_SCENARIO: 'device',
      E2E_INJECT_FAILURE: 'after-offline',
    });
  } else {
    if (mode === 'acceptance') {
      for (const scenario of ['1', '2', '3', '4', '5', '6', '7', '8'])
        await suite(`individual-${scenario}`, ['--scenario', scenario]);
    }
    await suite(mode === 'smoke' ? 'smoke' : 'full', [
      '--suite',
      mode === 'smoke' ? 'smoke' : 'full',
      '--repeat',
      mode === 'acceptance' ? '2' : '1',
    ]);
    if (mode !== 'smoke')
      await suite('regressions', ['--suite', 'regressions']);
  }
} finally {
  const status =
    groups.length && groups.every((group) => group.status === 'PASS')
      ? 'PASS'
      : 'FAIL';
  if (status === 'FAIL') process.exitCode = 1;
  await writeFile(
    path.join(output, 'ci-result.json'),
    JSON.stringify(
      { status, mode, sourceSha: process.env.GITHUB_SHA ?? 'local', groups },
      null,
      2,
    ),
  );
  const summary = [
    `# Android ${process.env.E2E_API ?? ''}: ${status}`,
    '',
    `Suite: ${mode}. Individual journey results and JUnit files are in the native artifact.`,
    '',
    '| Group | Status |',
    '| --- | --- |',
    ...groups.map((group) => `| ${group.name} | ${group.status} |`),
    '',
  ].join('\n');
  await writeFile(path.join(output, 'summary.md'), summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}
