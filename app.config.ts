import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID;
  const owner = process.env.EXPO_OWNER;
  const isE2E = process.env.BUILD_VARIANT === 'e2e';
  const configurationEnvironment = process.env;
  const hasE2EEnvironment =
    configurationEnvironment.EXPO_PUBLIC_APP_ENV === 'e2e';
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  if (
    isE2E !== hasE2EEnvironment ||
    (isE2E && buildProfile !== undefined && buildProfile !== 'e2e') ||
    (buildProfile === 'e2e' && !isE2E)
  )
    throw new Error('incompatible_e2e_build_configuration');
  return {
    ...config,
    name: config.name ?? 'Trabajador',
    slug: config.slug ?? 'seasonal-worker-mobile',
    ...(owner ? { owner } : {}),
    ...(projectId ? { extra: { ...config.extra, eas: { projectId } } } : {}),
    ...(isE2E
      ? {
          name: 'Temporada E2E',
          scheme: 'temporada-e2e',
          extra: {
            ...config.extra,
            ...(projectId ? { eas: { projectId } } : {}),
            buildVariant: 'e2e',
          },
          android: {
            ...config.android,
            package: 'com.cremedigital.seasonalworker.e2e',
          },
          ios: {
            ...config.ios,
            bundleIdentifier: 'com.cremedigital.seasonalworker.e2e',
            infoPlist: {
              ...config.ios?.infoPlist,
              NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
            },
          },
          plugins: [
            ...(config.plugins ?? []),
            './plugins/with-e2e-android.cjs',
          ],
        }
      : {}),
  };
};
