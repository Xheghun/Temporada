import {
  e2eApplicationId,
  isE2EApplication,
  resolveApiBaseUrl,
} from './runtime-policy';

test('public settings cannot enable E2E on the production native identity', () => {
  expect(() =>
    isE2EApplication('com.cremedigital.seasonalworker', 'e2e'),
  ).toThrow('incompatible_e2e_runtime_configuration');
  expect(() => isE2EApplication(null, 'e2e')).toThrow();
  expect(() => isE2EApplication(e2eApplicationId, 'production')).toThrow();
  expect(isE2EApplication(e2eApplicationId, 'e2e')).toBe(true);
  expect(
    isE2EApplication('com.cremedigital.seasonalworker', 'production'),
  ).toBe(false);
});

test('release API configuration requires HTTPS outside the isolated E2E app', () => {
  expect(() =>
    resolveApiBaseUrl('http://127.0.0.1:3101', false, false),
  ).toThrow('api_configuration_missing');
  expect(resolveApiBaseUrl('https://api.example.test', false, false)).toBe(
    'https://api.example.test',
  );
  expect(() => resolveApiBaseUrl(undefined, false, false)).toThrow();
  expect(resolveApiBaseUrl('http://127.0.0.1:3101', true, false)).toBe(
    'http://127.0.0.1:3101',
  );
});

test('E2E configuration accepts only the local fixture API', () => {
  expect(resolveApiBaseUrl('http://127.0.0.1:3101', false, true)).toBe(
    'http://127.0.0.1:3101',
  );
  for (const url of [
    'https://api.example.test',
    'http://localhost:3101',
    'http://127.0.0.1.evil.test',
    'http://name:password@127.0.0.1:3101',
  ])
    expect(() => resolveApiBaseUrl(url, false, true)).toThrow(
      'e2e_requires_loopback_api',
    );
});
