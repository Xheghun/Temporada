export type CheckCoverage = {
  briefScenario: number | null;
  requirements: readonly string[];
  tests: readonly string[];
};
const original: Record<string, CheckCoverage> = {
  '1': { briefScenario: 1, requirements: ['M9'], tests: [] },
  '2': {
    briefScenario: 2,
    requirements: ['M1', 'M2', 'M3', 'M4', 'M6', 'M7'],
    tests: ['TEST-01', 'TEST-02'],
  },
  '3': {
    briefScenario: 3,
    requirements: ['M2', 'M3', 'M4'],
    tests: ['TEST-03'],
  },
  '4': {
    briefScenario: 4,
    requirements: ['M1', 'M3', 'M6'],
    tests: ['TEST-05'],
  },
  '5': {
    briefScenario: 5,
    requirements: ['M3', 'M5', 'M7', 'M8', 'M9'],
    tests: ['TEST-04'],
  },
  '6': {
    briefScenario: 6,
    requirements: ['M1', 'M2', 'M3', 'M5'],
    tests: ['TEST-04'],
  },
  '7': {
    briefScenario: 7,
    requirements: ['M2', 'M3', 'M8', 'M10'],
    tests: ['TEST-06'],
  },
  '8': { briefScenario: 8, requirements: ['M1', 'M2', 'M3', 'M10'], tests: [] },
};
export function coverageFor(scenario: string): CheckCoverage {
  if (scenario.startsWith('replay-'))
    return {
      briefScenario: null,
      requirements: ['M2', 'M3', 'M4'],
      tests: ['TEST-03R'],
    };
  if (scenario === 'measurements')
    return {
      briefScenario: null,
      requirements: ['M2', 'M7'],
      tests: ['TEST-02'],
    };
  return (
    original[scenario.split('-')[0] ?? ''] ?? {
      briefScenario: null,
      requirements: [],
      tests: [],
    }
  );
}
