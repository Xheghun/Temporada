import assert from 'node:assert/strict';
const applicationId = 'com.cremedigital.seasonalworker.e2e';
export async function readHealthBaseline(adb) {
  return {
    crashes: await adb('logcat', '-b', 'crash', '-d', '-v', 'epoch'),
    activity: await adb(
      'logcat',
      '-d',
      '-v',
      'epoch',
      '-s',
      'ActivityManager:I',
    ),
    anr: await adb('shell', 'dumpsys', 'activity', 'lastanr'),
  };
}
export async function verifyNativeHealth(adb, before) {
  const after = await readHealthBaseline(adb);
  const crashes = after.crashes
    .split('\n')
    .filter(
      (line) =>
        line.includes(`Process: ${applicationId},`) &&
        !before.crashes.includes(line),
    );
  const processEvents = after.activity
    .split('\n')
    .filter(
      (line) =>
        line.includes(applicationId) &&
        /Killing|has died|Force stopping/.test(line) &&
        !before.activity.includes(line),
    );
  const hasNewAnr =
    after.anr.includes(applicationId) && after.anr !== before.anr;
  assert.equal(crashes.length, 0, 'Unexpected E2E application crash');
  assert.equal(hasNewAnr, false, 'Unexpected E2E application ANR');
  return {
    crashes: crashes.length,
    anr: hasNewAnr,
    processEvents,
    note: 'Process events include intentional force-stop/reboot operations; retention is asserted separately.',
  };
}
