import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectNative } from './native-inspection.mjs';
import { androidDevice } from './android-device.mjs';

export async function verifyDeviceDurability({ adb, flow, output, before }) {
  const device = androidDevice({ adb, flow });
  const trace = async () => {
    const response = await fetch('http://127.0.0.1:3101/__dev/trace', {
      signal: AbortSignal.timeout(2000),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const baseline = await trace();
  const snapshots = [];
  for (const restart of ['force-stop', 'reboot']) {
    if (restart === 'force-stop') await device.forceStop();
    else await device.reboot();
    await device.relaunch();
    await flow('device-offline');
    const after = await inspectNative({ adb, flow, output });
    assert.deepEqual(
      after.actions,
      before.actions,
      `${restart} changed durable actions or bytes`,
    );
    assert.deepEqual(
      after.submissions,
      before.submissions,
      `${restart} changed submissions`,
    );
    const observation = await trace();
    assert.equal(
      observation.totalAttempts,
      baseline.totalAttempts,
      'Offline device sent a worker request',
    );
    snapshots.push({
      restart,
      inspection: after,
      totalAttempts: observation.totalAttempts,
    });
  }
  await writeFile(
    path.join(output, 'device-durability.json'),
    JSON.stringify({ before, baseline, snapshots }, null, 2),
  );
  if (process.env.E2E_INJECT_FAILURE === 'after-offline') {
    throw new Error('intentional_failure_after_offline');
  }
  await device.online();
}
