import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncFixture } from './sync-fixture.mts';
test('fresh database defaults to English; saved Spanish and queued intent survive repeat migration/reopen', async () => {
  const context = await syncFixture();
  try {
    assert.equal(
      (
        await context.database.first<{ language: string }>(
          'SELECT language FROM app_settings WHERE id=1',
        )
      )?.language,
      'en',
    );
    await context.database.run(
      "UPDATE app_settings SET language='es' WHERE id=1",
    );
    const action = await context.worker().enqueueTerms('v2');
    await context.reopen();
    await context.reopen();
    assert.equal(
      (
        await context.database.first<{ language: string }>(
          'SELECT language FROM app_settings WHERE id=1',
        )
      )?.language,
      'es',
    );
    assert.equal((await context.worker().listActions())[0]?.id, action.id);
  } finally {
    await context.close();
  }
});
