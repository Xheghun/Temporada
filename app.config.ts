import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EAS_PROJECT_ID;
  const owner = process.env.EXPO_OWNER;
  return {
    ...config,
    name: config.name ?? 'Trabajador',
    slug: config.slug ?? 'seasonal-worker-mobile',
    ...(owner ? { owner } : {}),
    ...(projectId ? { extra: { ...config.extra, eas: { projectId } } } : {}),
  };
};
