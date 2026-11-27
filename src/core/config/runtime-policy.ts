export const e2eApplicationId = 'com.cremedigital.seasonalworker.e2e';

export function isE2EApplication(
  applicationId: string | null,
  environment: string | undefined,
): boolean {
  const hasTestIdentity = applicationId === e2eApplicationId;
  const hasTestEnvironment = environment === 'e2e';
  if (hasTestIdentity !== hasTestEnvironment)
    throw new Error('incompatible_e2e_runtime_configuration');
  return hasTestIdentity && hasTestEnvironment;
}

export function resolveApiBaseUrl(
  value: string | undefined,
  development: boolean,
  isE2E: boolean,
): string {
  if (
    !value ||
    !/^https?:\/\//.test(value) ||
    (!development && !isE2E && !value.startsWith('https://'))
  )
    throw new Error('api_configuration_missing');
  if (isE2E) {
    const url = new URL(value);
    if (
      url.protocol !== 'http:' ||
      url.hostname !== '127.0.0.1' ||
      url.username ||
      url.password
    )
      throw new Error('e2e_requires_loopback_api');
  }
  return value;
}
