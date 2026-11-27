import type { Selection } from './selection.mts';

export type Outcome = {
  scenario: string;
  repetition: number;
  status: 'PASS' | 'FAIL' | 'NOT RUN';
  output: string;
  error?: string;
  initialFixtureHash?: string;
};
export type ScenarioExecutor = (
  scenario: string,
  outputName: string,
) => Promise<{ initialFixtureHash: string } | null>;

export async function executeSuite(
  selection: Selection,
  executeScenario: ScenarioExecutor,
) {
  const outcomes: Outcome[] = [];
  const initialFixtures = new Map<string, string>();
  for (let repetition = 1; repetition <= selection.repetitions; repetition++) {
    for (const scenario of selection.scenarios) {
      const outcome: Outcome = {
        scenario,
        repetition,
        status: 'NOT RUN',
        output: `${scenario}-${repetition}`,
      };
      outcomes.push(outcome);
      try {
        const execution = await executeScenario(scenario, outcome.output);
        if (!execution) {
          outcome.error = 'Scenario implementation is pending';
          continue;
        }
        const previousHash = initialFixtures.get(scenario);
        if (previousHash && previousHash !== execution.initialFixtureHash)
          throw new Error('Independent runs started from different fixtures');
        initialFixtures.set(scenario, execution.initialFixtureHash);
        outcome.initialFixtureHash = execution.initialFixtureHash;
        outcome.status = 'PASS';
      } catch (error) {
        outcome.status = 'FAIL';
        outcome.error = String(error);
      }
    }
  }
  return {
    status:
      outcomes.length > 0 &&
      outcomes.every((outcome) => outcome.status === 'PASS')
        ? 'PASS'
        : 'FAIL',
    selection,
    outcomes,
  };
}
