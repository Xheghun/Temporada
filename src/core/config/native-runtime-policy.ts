import { applicationId } from 'expo-application';
import Constants from 'expo-constants';
import { isE2EApplication } from './runtime-policy';

export function isE2ERuntime(): boolean {
  const buildVariant: unknown = Constants.expoConfig?.extra?.buildVariant;
  return isE2EApplication(
    applicationId,
    typeof buildVariant === 'string' ? buildVariant : undefined,
  );
}

export function isNativeInspectionAllowed(): boolean {
  return (
    isE2ERuntime() ||
    (__DEV__ && process.env.EXPO_PUBLIC_ASSESSMENT_MODE === '1')
  );
}
