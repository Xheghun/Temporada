import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workspace = await mkdtemp(path.join(tmpdir(), 'temporada-e2e-build-'));
const output = path.resolve(
  process.env.E2E_APK ?? 'e2e-results/temporada-e2e.apk',
);
const abi = process.env.E2E_ANDROID_ABI ?? 'x86_64';
assert(['x86_64', 'arm64-v8a'].includes(abi), 'Unsupported test ABI');
const environment = {
  ...process.env,
  BUILD_VARIANT: 'e2e',
  EXPO_PUBLIC_APP_ENV: 'e2e',
  EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3101',
  E2E_KEYSTORE_PATH: path.join(workspace, 'test-signing.jks'),
  E2E_KEY_PASSWORD: randomBytes(24).toString('hex'),
};

async function run(executable, argumentsList, cwd = workspace) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, argumentsList, {
      cwd,
      env: environment,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`${path.basename(executable)} failed (${code ?? signal})`),
        );
    });
  });
}

try {
  // Copy only build inputs. Keep the checkout, native folders and .env files untouched.
  for (const entry of [
    'app',
    'src',
    'plugins',
    'app.json',
    'app.config.ts',
    'package.json',
    'tsconfig.json',
  ]) {
    await cp(path.join(root, entry), path.join(workspace, entry), {
      recursive: true,
    });
  }
  await symlink(
    path.join(root, 'node_modules'),
    path.join(workspace, 'node_modules'),
    'dir',
  );
  await run(process.execPath, [
    path.join(root, 'node_modules/expo/bin/cli'),
    'prebuild',
    '--platform',
    'android',
    '--no-install',
  ]);
  await run('keytool', [
    '-genkeypair',
    '-noprompt',
    '-keystore',
    environment.E2E_KEYSTORE_PATH,
    '-alias',
    'fictional-e2e',
    '-keyalg',
    'RSA',
    '-keysize',
    '2048',
    '-validity',
    '1',
    '-dname',
    'CN=Fictional E2E',
    '-storepass:env',
    'E2E_KEY_PASSWORD',
    '-keypass:env',
    'E2E_KEY_PASSWORD',
  ]);
  const gradle = path.join(workspace, 'android/app/build.gradle');
  const configuration = await readFile(gradle, 'utf8');
  await writeFile(
    gradle,
    `${configuration}\nandroid {
    signingConfigs {
        e2e {
            storeFile file(System.getenv('E2E_KEYSTORE_PATH'))
            storePassword System.getenv('E2E_KEY_PASSWORD')
            keyAlias 'fictional-e2e'
            keyPassword System.getenv('E2E_KEY_PASSWORD')
        }
    }
    buildTypes { release { signingConfig signingConfigs.e2e } }
}\n`,
  );
  await run(
    path.join(workspace, 'android/gradlew'),
    [
      ':app:assembleRelease',
      '--no-daemon',
      ...(process.env.E2E_BUILD_DIAGNOSTICS === '1'
        ? ['--info', '--stacktrace']
        : []),
      `-PreactNativeArchitectures=${abi}`,
    ],
    path.join(workspace, 'android'),
  );
  const apk = path.join(
    workspace,
    'android/app/build/outputs/apk/release/app-release.apk',
  );
  await mkdir(path.dirname(output), { recursive: true });
  await cp(apk, output, { recursive: false, force: true });
  const bytes = await readFile(output);
  await writeFile(
    `${output}.json`,
    JSON.stringify(
      {
        sourceSha: process.env.GITHUB_SHA ?? 'local',
        applicationId: 'com.cremedigital.seasonalworker.e2e',
        variant: 'release-e2e',
        abi,
        metroRequired: false,
        debuggable: false,
        inspectionEnabled: true,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      },
      null,
      2,
    ),
  );
  console.log(`Bundled E2E APK: ${output}`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
