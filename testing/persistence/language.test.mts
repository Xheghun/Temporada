import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncFixture } from './sync-fixture.mts';
for (const language of ['en', 'es'] as const) {
  test(`fresh database defaults to Spanish; saved ${language} and queued intent survive repeat migration/reopen`, async () => {
    const testContext = await syncFixture();
    try {
      assert.equal(
        (
          await testContext.database.first<{ language: string }>(
            'SELECT language FROM app_settings WHERE id=1',
          )
        )?.language,
        'es',
      );
      await testContext.database.run(
        'UPDATE app_settings SET language=? WHERE id=1',
        [language],
      );
      const action = await testContext.worker().enqueueTerms('v2');
      await testContext.reopen();
      await testContext.reopen();
      assert.equal(
        (
          await testContext.database.first<{ language: string }>(
            'SELECT language FROM app_settings WHERE id=1',
          )
        )?.language,
        language,
      );
      assert.equal(
        (await testContext.worker().listActions())[0]?.id,
        action.id,
      );
    } finally {
      await testContext.close();
    }
  });
}
