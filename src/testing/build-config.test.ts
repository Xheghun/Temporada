import type { ConfigContext } from 'expo/config';
import buildConfig from '../../app.config';

const originalEnvironment = { ...process.env };
const context: ConfigContext = {
  projectRoot: '/fictional-project',
  staticConfigPath: null,
  packageJsonPath: null,
  config: {
    name: 'Trabajador',
    slug: 'seasonal-worker-mobile',
    android: { package: 'com.cremedigital.seasonalworker' },
    ios: { bundleIdentifier: 'com.cremedigital.seasonalworker' },
  },
};
beforeEach(() => {
  delete process.env.BUILD_VARIANT;
  delete process.env.EXPO_PUBLIC_APP_ENV;
  delete process.env.EAS_BUILD_PROFILE;
});
afterEach(() => {
  process.env = { ...originalEnvironment };
});

test('the E2E build has a separate native identity and HTTP plugin', () => {
  process.env.BUILD_VARIANT = 'e2e';
  process.env.EXPO_PUBLIC_APP_ENV = 'e2e';
  const configuration = buildConfig(context);
  expect(configuration.android?.package).toBe(
    'com.cremedigital.seasonalworker.e2e',
  );
  expect(configuration.ios?.bundleIdentifier).toBe(
    'com.cremedigital.seasonalworker.e2e',
  );
  expect(configuration.plugins).toContain('./plugins/with-e2e-android.cjs');
});

test.each(['production', 'preview', 'development'])(
  'E2E settings are rejected in the %s profile',
  (profile) => {
    process.env.EAS_BUILD_PROFILE = profile;
    process.env.BUILD_VARIANT = 'e2e';
    process.env.EXPO_PUBLIC_APP_ENV = 'e2e';
    expect(() => buildConfig(context)).toThrow(
      'incompatible_e2e_build_configuration',
    );
  },
);

test('a public variable alone cannot create a test build', () => {
  process.env.EXPO_PUBLIC_APP_ENV = 'e2e';
  expect(() => buildConfig(context)).toThrow();
});

test('ordinary production builds preserve their identity without test plugins', () => {
  process.env.EAS_BUILD_PROFILE = 'production';
  const configuration = buildConfig(context);
  expect(configuration.android?.package).toBe(
    'com.cremedigital.seasonalworker',
  );
  expect(configuration.ios?.bundleIdentifier).toBe(
    'com.cremedigital.seasonalworker',
  );
  expect(configuration.plugins ?? []).not.toContain(
    './plugins/with-e2e-android.cjs',
  );
});
