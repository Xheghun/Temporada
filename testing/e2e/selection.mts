export type Suite =
  'bootstrap' | 'media' | 'device' | 'regressions' | 'smoke' | 'full';
export type Selection = { scenarios: string[]; repetitions: number };

export function selectScenarios(argumentsList: string[]): Selection {
  let suite: Suite | undefined;
  let scenario: string | undefined;
  let repetitions = 1;
  const provided = new Set<string>();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const flag = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!flag || !value || provided.has(flag))
      throw new Error('Missing or repeated E2E option');
    provided.add(flag);
    if (
      flag === '--suite' &&
      ['bootstrap', 'media', 'device', 'regressions', 'smoke', 'full'].includes(
        value,
      )
    )
      suite = value as Suite;
    else if (
      flag === '--scenario' &&
      /^(bootstrap|media-es|media-en|device|measurements|[1-8]|2-reboot|3-restart|5-422|6-latency|8-logout|replay-approved|replay-correction)$/.test(
        value,
      )
    )
      scenario = value;
    else if (flag === '--repeat' && /^[1-5]$/.test(value))
      repetitions = Number(value);
    else throw new Error(`Unsupported E2E option: ${flag} ${value}`);
  }
  if (suite && scenario) throw new Error('Choose a suite or one scenario');
  if (scenario) return { scenarios: [scenario], repetitions };
  const suites: Record<Suite, string[]> = {
    bootstrap: ['bootstrap'],
    media: ['media-es', 'media-en'],
    device: ['device'],
    regressions: [
      '2-reboot',
      '3-restart',
      '5-422',
      '6-latency',
      '8-logout',
      'replay-approved',
      'replay-correction',
    ],
    smoke: ['1', '2'],
    full: ['1', '2', '3', '4', '5', '6', '7', '8'],
  };
  return { scenarios: suites[suite ?? 'smoke'], repetitions };
}
