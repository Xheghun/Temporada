import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { selectScenarios } from './selection.mts';

import { executeSuite } from './execute-suite.mts';

const selection = selectScenarios(process.argv.slice(2));
const output = path.resolve(
  process.env.E2E_OUTPUT ??
    `e2e-results/runs/${new Date().toISOString().replaceAll(':', '-')}`,
);
await mkdir(path.dirname(output), { recursive: true });
// Never replace a previous run's first failure or screenshots.
await mkdir(output);
const implementedScenarios = new Map([
  ['bootstrap', 'testing/e2e/bootstrap-android.mjs'],
  ['media-es', 'testing/e2e/bootstrap-android.mjs'],
  ['media-en', 'testing/e2e/bootstrap-android.mjs'],
  ['device', 'testing/e2e/bootstrap-android.mjs'],
  ['2', 'testing/e2e/bootstrap-android.mjs'],
]);

const report = await executeSuite(selection, async (scenario, outputName) => {
  const scenarioOutput = path.join(output, outputName);
  const script = implementedScenarios.get(scenario);
  if (!script) return null;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_OUTPUT: scenarioOutput,
        E2E_SCENARIO: scenario,
      },
    });
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`Scenario process failed (${code ?? signal})`)),
    );
  });
  const nativeReport: unknown = JSON.parse(
    await readFile(path.join(scenarioOutput, 'result.json'), 'utf8'),
  );
  if (
    typeof nativeReport !== 'object' ||
    nativeReport === null ||
    !('status' in nativeReport) ||
    nativeReport.status !== 'PASS'
  )
    throw new Error('Native scenario did not report PASS');
  const fixture = await readFile(
    path.join(scenarioOutput, 'initial-fixture.json'),
  );
  const hash = createHash('sha256').update(fixture).digest('hex');
  return { initialFixtureHash: hash };
});
if (report.status !== 'PASS') process.exitCode = 1;
await writeFile(
  path.join(output, 'suite.json'),
  JSON.stringify(
    { ...report, sourceSha: process.env.GITHUB_SHA ?? 'local' },
    null,
    2,
  ),
);
await writeFile(
  path.join(output, 'summary.md'),
  [
    `# E2E run: ${report.status}`,
    '',
    '| Scenario | Repetition | Status |',
    '| --- | --- | --- |',
    ...report.outcomes.map(
      (outcome) =>
        `| ${outcome.scenario} | ${outcome.repetition} | ${outcome.status} |`,
    ),
    '',
  ].join('\n'),
);
console.log(`E2E ${report.status}: ${path.join(output, 'suite.json')}`);
