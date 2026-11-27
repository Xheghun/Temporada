import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';

export async function runScenarioFour(context) {
  const { flow, output } = context;
  const device = androidDevice(context);
  const translations = JSON.parse(
    await readFile('src/core/i18n/es.json', 'utf8'),
  );
  const labels = (version) => ({
    VERSION_LABEL: translations.terms.version.replace('{{version}}', version),
    UNCONFIRMED_LABEL: translations.terms.status.unconfirmed,
  });
  await device.offline();
  await flow('terms-open', labels('v2'));
  const unconfirmed = await inspectNative(context);
  assert.equal(unconfirmed.actions.length, 0);
  // Return to v2 before publication; no acceptance is created by opening it.
  await flow('terms-open', labels('v2'));
  await fixtureRequest('/__dev/terms', { version: 'v3' });
  await flow('terms-tap-confirm');
  const queued = await inspectNative(context);
  assert.equal(queued.actions.length, 1);
  assert.equal(queued.actions[0].termsVersionId, 'v2');
  assert.equal(queued.actions[0].status, 'queued');
  await device.online();
  const stale = await waitForObservation(
    'v2 stale with unconfirmed v3',
    () => inspectNative(context),
    (inspection) =>
      inspection.termsVersionId === 'v3' &&
      inspection.actions[0]?.status === 'stale',
  );
  assert.equal(stale.serverAcceptanceStatus, 'not_confirmed');
  const beforeConfirmation = await fixtureRequest('/__dev/state');
  assert.equal(
    beforeConfirmation.acceptances.filter(
      (acceptance) => acceptance.workerId === 'ana',
    ).length,
    0,
  );
  await flow('terms-open', labels('v3'));
  await flow('terms-tap-confirm');
  const delivered = await waitForObservation(
    'explicit new v3 delivery',
    () => inspectNative(context),
    (inspection) =>
      inspection.actions.length === 2 &&
      inspection.actions.some(
        (action) =>
          action.termsVersionId === 'v3' && action.status === 'delivered',
      ),
  );
  const oldAction = delivered.actions.find(
    (action) => action.termsVersionId === 'v2',
  );
  const newAction = delivered.actions.find(
    (action) => action.termsVersionId === 'v3',
  );
  assert.equal(oldAction.clientActionId, queued.actions[0].clientActionId);
  assert.equal(oldAction.status, 'stale');
  assert.notEqual(oldAction.clientActionId, newAction.clientActionId);
  assert.equal(delivered.serverAcceptanceStatus, 'accepted');
  const server = await fixtureRequest('/__dev/state');
  const acceptances = server.acceptances.filter(
    (acceptance) => acceptance.workerId === 'ana',
  );
  assert.equal(acceptances.length, 1);
  assert.equal(acceptances[0].termsVersionId, 'v3');
  assert.equal(acceptances[0].clientActionId, newAction.clientActionId);
  await flow('terms-stale-history', {
    STALE_LABEL: translations.terms.staleHistory.replace('{{version}}', 'v2'),
  });
  await writeFile(
    path.join(output, 'scenario-4.json'),
    JSON.stringify(
      {
        status: 'PASS',
        requirements: ['M1', 'M3', 'M6'],
        tests: ['TEST-05'],
        unconfirmed,
        queued,
        stale,
        delivered,
        beforeConfirmation,
        server,
      },
      null,
      2,
    ),
  );
}
