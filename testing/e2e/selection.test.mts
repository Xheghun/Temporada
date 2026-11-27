import assert from 'node:assert/strict';
import test from 'node:test';
import { selectScenarios } from './selection.mts';
import { executeSuite } from './execute-suite.mts';

test('full selection always includes every original scenario', () => {
  assert.deepEqual(selectScenarios(['--suite', 'full', '--repeat', '2']), {
    scenarios: ['1', '2', '3', '4', '5', '6', '7', '8'],
    repetitions: 2,
  });
  assert.deepEqual(selectScenarios(['--scenario', '4']), {
    scenarios: ['4'],
    repetitions: 1,
  });
});

test('ambiguous or unknown options cannot silently reduce acceptance coverage', () => {
  for (const argumentsList of [
    ['--suite', 'full', '--scenario', '2'],
    ['--scenario', '9'],
    ['--suite', 'smok'],
    ['--repeat', '0'],
    ['--repeat', '2', '--repeat', '1'],
    ['--suite'],
    ['--app-id', 'com.cremedigital.seasonalworker'],
  ])
    assert.throws(() => selectScenarios(argumentsList));
});

test('an unimplemented full suite fails with eight explicit NOT RUN results', async () => {
  const report = await executeSuite(
    selectScenarios(['--suite', 'full']),
    async () => null,
  );
  assert.equal(report.status, 'FAIL');
  assert.equal(report.outcomes.length, 8);
  assert(
    report.outcomes.every(
      (outcome: { status: string }) => outcome.status === 'NOT RUN',
    ),
  );
});

test('a later pass never erases the first failure and changed fixtures fail', async () => {
  let attempts = 0;
  const selection = selectScenarios(['--scenario', '2', '--repeat', '2']);
  const failed = await executeSuite(selection, async () => {
    attempts++;
    if (attempts === 1) throw new Error('original failure');
    return { initialFixtureHash: 'fixture-a' };
  });
  assert.equal(failed.status, 'FAIL');
  assert.deepEqual(
    failed.outcomes.map((outcome) => outcome.status),
    ['FAIL', 'PASS'],
  );
  assert.match(failed.outcomes[0]?.error ?? '', /original failure/);
  attempts = 0;
  const changed = await executeSuite(selection, async () => ({
    initialFixtureHash: `fixture-${attempts++}`,
  }));
  assert.equal(changed.status, 'FAIL');
  assert.match(changed.outcomes[1]?.error ?? '', /different fixtures/);
});

test('acceptance mapping includes all mandatory sync tests without counting probes as brief journeys', async () => {
  const { coverageFor } = await import('./coverage.mts');
  const cases = [
    ...selectScenarios(['--suite', 'full']).scenarios,
    ...selectScenarios(['--suite', 'regressions']).scenarios,
  ];
  const requirements = new Set(
    cases.flatMap((scenario) => [...coverageFor(scenario).requirements]),
  );
  const tests = new Set(
    cases.flatMap((scenario) => [...coverageFor(scenario).tests]),
  );
  for (let number = 1; number <= 10; number++)
    assert(requirements.has(`M${number}`));
  for (const id of [
    'TEST-01',
    'TEST-02',
    'TEST-03',
    'TEST-03R',
    'TEST-04',
    'TEST-05',
    'TEST-06',
  ])
    assert(tests.has(id));
  for (const probe of [
    'bootstrap',
    'media-es',
    'media-en',
    'device',
    'measurements',
  ])
    assert.equal(coverageFor(probe).briefScenario, null);
});
