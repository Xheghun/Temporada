import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

assert.equal(process.platform, 'darwin', 'iOS simulator builds require macOS');
const execute = promisify(execFile);
const swift = (await execute('xcrun', ['swift', '--version'])).stdout;
const compilerVersion = /Swift version (\d+)\.(\d+)/.exec(swift);
assert(
  compilerVersion &&
    (Number(compilerVersion[1]) > 6 ||
      (Number(compilerVersion[1]) === 6 && Number(compilerVersion[2]) >= 2)),
  'Expo SDK 58 requires Swift 6.2 or newer; select Xcode 26 with DEVELOPER_DIR',
);
const root = fileURLToPath(new URL('../../', import.meta.url));
const workspace = await mkdtemp(
  path.join(tmpdir(), 'temporada-e2e-ios-build-'),
);
const output = path.resolve(
  process.env.E2E_IOS_ARCHIVE ?? 'e2e-results/temporada-e2e-ios.tar.gz',
);
const environment = {
  ...process.env,
  BUILD_VARIANT: 'e2e',
  EXPO_PUBLIC_APP_ENV: 'e2e',
  EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3101',
};
const run = (executable, argumentsList, cwd = workspace) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, argumentsList, {
      cwd,
      env: environment,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${path.basename(executable)} failed (${code ?? signal})`,
            ),
          ),
    );
  });
try {
  for (const entry of [
    'app',
    'src',
    'plugins',
    'app.json',
    'app.config.ts',
    'package.json',
    'tsconfig.json',
  ])
    await cp(path.join(root, entry), path.join(workspace, entry), {
      recursive: true,
    });
  await symlink(
    path.join(root, 'node_modules'),
    path.join(workspace, 'node_modules'),
    'dir',
  );
  await run(process.execPath, [
    path.join(root, 'node_modules/expo/bin/cli'),
    'prebuild',
    '--platform',
    'ios',
    '--no-install',
  ]);
  await run('pod', ['install'], path.join(workspace, 'ios'));
  const projects = (await readdir(path.join(workspace, 'ios'))).filter((name) =>
    name.endsWith('.xcworkspace'),
  );
  assert.equal(projects.length, 1, 'Expected one generated iOS workspace');
  const scheme = projects[0].replace(/\.xcworkspace$/, '');
  await run('xcodebuild', [
    '-workspace',
    path.join(workspace, 'ios', projects[0]),
    '-scheme',
    scheme,
    '-configuration',
    'Release',
    '-sdk',
    'iphonesimulator',
    '-destination',
    'generic/platform=iOS Simulator',
    '-derivedDataPath',
    path.join(workspace, 'derived'),
    'CODE_SIGNING_ALLOWED=NO',
    'build',
  ]);
  const products = path.join(
    workspace,
    'derived/Build/Products/Release-iphonesimulator',
  );
  const applications = (await readdir(products)).filter((name) =>
    name.endsWith('.app'),
  );
  assert.equal(applications.length, 1);
  const app = path.join(products, applications[0]);
  const identifier = (
    await execute('/usr/libexec/PlistBuddy', [
      '-c',
      'Print:CFBundleIdentifier',
      path.join(app, 'Info.plist'),
    ])
  ).stdout.trim();
  assert.equal(identifier, 'com.cremedigital.seasonalworker.e2e');
  assert(
    (await readFile(path.join(app, 'main.jsbundle'))).length > 0,
    'Simulator app must bundle JavaScript',
  );
  await mkdir(path.dirname(output), { recursive: true });
  await run('tar', ['-czf', output, '-C', products, applications[0]]);
  await writeFile(
    `${output}.json`,
    JSON.stringify(
      {
        sourceSha: process.env.GITHUB_SHA ?? 'local',
        applicationId: identifier,
        variant: 'release-e2e-simulator',
        hostArchitecture: process.arch,
        metroRequired: false,
        inspectionEnabled: true,
        signing: 'disabled for simulator',
        sha256: createHash('sha256')
          .update(await readFile(output))
          .digest('hex'),
        xcode: (await execute('xcodebuild', ['-version'])).stdout.trim(),
        cocoaPods: (await execute('pod', ['--version'])).stdout.trim(),
        swift: swift.trim(),
      },
      null,
      2,
    ),
  );
  console.log(`Bundled simulator archive: ${output}`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
