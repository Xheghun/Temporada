/** Remote configuration is untrusted. Missing, invalid or unavailable flags stay off. */
export interface FeatureFlagProvider {
  load(): Promise<unknown>;
}

export async function isFeatureEnabled(
  name: string,
  provider: FeatureFlagProvider,
): Promise<boolean> {
  try {
    const snapshot = await provider.load();
    if (
      typeof snapshot !== 'object' ||
      snapshot === null ||
      Array.isArray(snapshot)
    ) {
      return false;
    }
    return (
      Object.hasOwn(snapshot, name) && Reflect.get(snapshot, name) === true
    );
  } catch {
    // Configuration unavailability has an explicit fail-closed recovery policy.
    return false;
  }
}
