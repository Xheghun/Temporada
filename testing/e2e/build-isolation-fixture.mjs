import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
const sdk = process.env.ANDROID_HOME;
const api = process.env.E2E_API;
assert(sdk && ['28', '34'].includes(api), 'Select the installed CI SDK');
const directory = await mkdtemp(path.join(tmpdir(), 'temporada-isolation-'));
const output = path.resolve('e2e-results/isolation-fixture.apk');
const tools = path.join(sdk, 'build-tools/37.0.0');
const androidJar = path.join(sdk, `platforms/android-${api}/android.jar`);
const environment = {
  ...process.env,
  E2E_FIXTURE_KEY_PASSWORD: randomBytes(24).toString('hex'),
};
const run = (executable, argumentsList) =>
  executeFile(executable, argumentsList, { env: environment, timeout: 60_000 });
try {
  const classes = path.join(directory, 'classes');
  const dex = path.join(directory, 'dex');
  await mkdir(classes);
  await mkdir(dex);
  await mkdir(path.dirname(output), { recursive: true });
  const manifest = path.join(directory, 'AndroidManifest.xml');
  await writeFile(
    manifest,
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.cremedigital.seasonalworker" android:versionCode="1" android:versionName="isolation-fixture">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="28"/>
    <application android:debuggable="true" android:label="Isolation fixture">
      <activity android:name=".IsolationFixture" android:exported="true">
        <intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
      </activity>
    </application>
  </manifest>`,
  );
  await run('javac', [
    '-source',
    '8',
    '-target',
    '8',
    '-bootclasspath',
    androidJar,
    '-d',
    classes,
    'testing/e2e/fixtures/IsolationFixture.java',
  ]);
  await run(path.join(tools, 'd8'), [
    '--lib',
    androidJar,
    '--output',
    dex,
    path.join(
      classes,
      'com/cremedigital/seasonalworker/IsolationFixture.class',
    ),
  ]);
  const unsigned = path.join(directory, 'unsigned.apk');
  await run(path.join(tools, 'aapt'), [
    'package',
    '-f',
    '-M',
    manifest,
    '-I',
    androidJar,
    '-F',
    unsigned,
  ]);
  await run('zip', ['-j', unsigned, path.join(dex, 'classes.dex')]);
  const aligned = path.join(directory, 'aligned.apk');
  await run(path.join(tools, 'zipalign'), ['-f', '4', unsigned, aligned]);
  const keystore = path.join(directory, 'test.jks');
  await run('keytool', [
    '-genkeypair',
    '-noprompt',
    '-keystore',
    keystore,
    '-alias',
    'isolation',
    '-keyalg',
    'RSA',
    '-validity',
    '1',
    '-dname',
    'CN=Fictional Isolation Fixture',
    '-storepass:env',
    'E2E_FIXTURE_KEY_PASSWORD',
    '-keypass:env',
    'E2E_FIXTURE_KEY_PASSWORD',
  ]);
  await run(path.join(tools, 'apksigner'), [
    'sign',
    '--ks',
    keystore,
    '--ks-pass',
    'env:E2E_FIXTURE_KEY_PASSWORD',
    '--out',
    output,
    aligned,
  ]);
} finally {
  await rm(directory, { recursive: true, force: true });
}
