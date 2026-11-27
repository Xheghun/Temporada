import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  mkdir,
  writeFile,
  appendFile,
  readdir,
  readFile,
} from 'node:fs/promises';
import path from 'node:path';

const mode = process.env.E2E_SUITE ?? 'smoke';
const acceptanceGroup = process.env.E2E_ACCEPTANCE_GROUP ?? 'all';
assert(
  [
    'all',
    'individual',
    'full-first',
    'full-second',
    'regressions',
    'layouts',
    'measurements',
  ].includes(acceptanceGroup),
  'Unknown acceptance group',
);
assert(mode === 'acceptance' || acceptanceGroup === 'all');
assert(
  [
    'foundation',
    'smoke',
    'full',
    'acceptance',
    'layouts',
    'scenario',
    'intentional-failure',
  ].includes(mode),
  'Unknown CI suite',
);
assert(
  !process.env.E2E_REUSED_APK_RUN || ['scenario', 'foundation'].includes(mode),
  'APK reuse is restricted to driver debugging; acceptance requires a fresh build',
);
const output = path.resolve(process.env.E2E_OUTPUT ?? 'e2e-results/native');
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output);
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
  if (mode === 'acceptance' && acceptanceGroup !== 'all') {
    if (acceptanceGroup === 'individual') {
      for (const scenario of ['8', '7', '6', '5', '4', '3', '2', '1'])
        await suite(`individual-${scenario}`, ['--scenario', scenario]);
    } else if (acceptanceGroup.startsWith('full-')) {
      await suite(acceptanceGroup, ['--suite', 'full']);
    } else if (acceptanceGroup === 'regressions') {
      await suite('regressions', ['--suite', 'regressions']);
    } else if (acceptanceGroup === 'layouts') {
      await suite('layout-media', ['--suite', 'media'], {
        E2E_LAYOUT_VARIANT: '1',
      });
    } else {
      assert.equal(process.env.E2E_API, '28');
      await suite('measurements', ['--scenario', 'measurements']);
    }
  } else if (mode === 'layouts') {
    await suite('layout-media', ['--suite', 'media'], {
      E2E_LAYOUT_VARIANT: '1',
    });
  } else if (mode === 'foundation') {
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
      for (const scenario of ['8', '7', '6', '5', '4', '3', '2', '1'])
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
    if (mode !== 'smoke' && process.env.E2E_API === '28')
      await suite('measurements', ['--scenario', 'measurements']);
    if (mode === 'acceptance')
      await suite('layout-media', ['--suite', 'media'], {
        E2E_LAYOUT_VARIANT: '1',
      });
  }
} finally {
  const fixtureHashes = new Set();
  const journeys = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(filename);
      else if (entry.name === 'initial-fixture.json')
        fixtureHashes.add(
          createHash('sha256')
            .update(await readFile(filename))
            .digest('hex'),
        );
      else if (entry.name === 'suite.json')
        journeys.push(...JSON.parse(await readFile(filename, 'utf8')).outcomes);
    }
  }
  await collect(output);
  if (fixtureHashes.size > 1)
    groups.push({
      name: 'fixture-independence',
      status: 'FAIL',
      error: 'Independent runs began with different fixture state',
    });
  const status =
    groups.length && groups.every((group) => group.status === 'PASS')
      ? 'PASS'
      : 'FAIL';
  if (status === 'FAIL') process.exitCode = 1;
  await writeFile(
    path.join(output, 'ci-result.json'),
    JSON.stringify(
      {
        status,
        mode,
        acceptanceGroup,
        sourceSha: process.env.GITHUB_SHA ?? 'local',
        groups,
        journeys,
        initialFixtureHashes: [...fixtureHashes],
        reusedApkRunForDriverDebugging: process.env.E2E_REUSED_APK_RUN || null,
      },
      null,
      2,
    ),
  );
  const summary = [
    `# Android ${process.env.E2E_API ?? ''}: ${status}`,
    '',
    `Suite: ${mode}; group: ${acceptanceGroup}${process.env.E2E_REUSED_APK_RUN ? ' (driver debugging with an existing APK; not current-commit acceptance)' : ''}. Individual journey results and JUnit files are in the native artifact.`,
    '',
    '| Group | Status |',
    '| --- | --- |',
    ...groups.map((group) => `| ${group.name} | ${group.status} |`),
    '',
    '| Journey | Repetition | Status | Sync tests |',
    '| --- | --- | --- | --- |',
    ...journeys.map(
      (journey) =>
        `| ${journey.scenario} | ${journey.repetition} | ${journey.status} | ${journey.coverage?.tests?.join(', ') ?? ''} |`,
    ),
    '',
  ].join('\n');
  await writeFile(path.join(output, 'summary.md'), summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}
