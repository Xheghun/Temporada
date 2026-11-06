import { isFeatureEnabled } from './feature-flags';

describe('production feature gates', () => {
  it.each([undefined, null, [], {}, { uploads: 'true' }, { uploads: false }])(
    'keeps uploads off for invalid or missing configuration: %p',
    async (snapshot) => {
      await expect(
        isFeatureEnabled('uploads', { load: async () => snapshot }),
      ).resolves.toBe(false);
    },
  );
  it('keeps behavior off when the remote provider is unavailable', async () => {
    await expect(
      isFeatureEnabled('uploads', {
        load: async () => {
          throw new Error('unavailable');
        },
      }),
    ).resolves.toBe(false);
  });
  it('does not enable inherited flags', async () => {
    await expect(
      isFeatureEnabled('uploads', {
        load: async () => Object.create({ uploads: true }) as unknown,
      }),
    ).resolves.toBe(false);
  });
  it('enables only an explicitly true own flag', async () => {
    await expect(
      isFeatureEnabled('uploads', { load: async () => ({ uploads: true }) }),
    ).resolves.toBe(true);
  });
});
