import {
  isE2ERuntime,
  isNativeInspectionAllowed,
} from './native-runtime-policy';

let mockApplicationId = 'com.cremedigital.seasonalworker';
let mockBuildVariant: string | undefined;
jest.mock('expo-constants', () => ({
  get expoConfig() {
    return { extra: { buildVariant: mockBuildVariant } };
  },
}));
jest.mock('expo-application', () => ({
  get applicationId() {
    return mockApplicationId;
  },
}));
const originalEnvironment = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnvironment };
  mockApplicationId = 'com.cremedigital.seasonalworker';
  mockBuildVariant = undefined;
});

test('native inspection is disabled on an ordinary app without assessment mode', () => {
  delete process.env.EXPO_PUBLIC_ASSESSMENT_MODE;
  delete process.env.EXPO_PUBLIC_APP_ENV;
  expect(isE2ERuntime()).toBe(false);
  expect(isNativeInspectionAllowed()).toBe(false);
});

test('a public variable cannot open native inspection in the production package', () => {
  process.env.EXPO_PUBLIC_APP_ENV = 'e2e';
  expect(isE2ERuntime()).toBe(false);
  expect(isNativeInspectionAllowed()).toBe(false);
});

test('test metadata cannot enable inspection in the production native identity', () => {
  mockBuildVariant = 'e2e';
  expect(() => isE2ERuntime()).toThrow();
  expect(() => isNativeInspectionAllowed()).toThrow();
});

test('the native E2E identity and matching environment allow read-only inspection', () => {
  mockApplicationId = 'com.cremedigital.seasonalworker.e2e';
  mockBuildVariant = 'e2e';
  expect(isE2ERuntime()).toBe(true);
  expect(isNativeInspectionAllowed()).toBe(true);
});
