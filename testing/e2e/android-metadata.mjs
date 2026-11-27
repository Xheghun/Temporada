import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export async function readAndroidMetadata({ adb, command, sdk }) {
  const toolchain = JSON.parse(
    await readFile(new URL('./toolchain.json', import.meta.url), 'utf8'),
  );
  const api = await adb('shell', 'getprop', 'ro.build.version.sdk');
  const image = toolchain.android.images[api];
  assert(image, 'Acceptance target must be API 28 or API 34');
  if (process.env.E2E_API)
    assert.equal(api, process.env.E2E_API, 'Wrong API target');
  const abi = await adb('shell', 'getprop', 'ro.product.cpu.abi');
  assert.equal(abi, image.abi);
  const avd = (await adb('emu', 'avd', 'name')).split('\n')[0].trim();
  assert(/^[\w-]+$/.test(avd));
  const configuration = await readFile(
    path.join(
      process.env.ANDROID_AVD_HOME ?? path.join(homedir(), '.android/avd'),
      `${avd}.avd/config.ini`,
    ),
    'utf8',
  );
  assert.match(configuration, /^hw.ramSize\s*=\s*2048M?\s*$/m);
  const memory = await adb('shell', 'cat', '/proc/meminfo');
  const guestMemoryKiB = Number(/^MemTotal:\s+(\d+) kB/m.exec(memory)?.[1]);
  assert(
    guestMemoryKiB > 1_500_000 && guestMemoryKiB <= 2_097_152,
    'Wrong guest memory allocation',
  );
  const emulator = await readFile(
    path.join(sdk, 'emulator/source.properties'),
    'utf8',
  );
  assert(
    emulator.includes(`Pkg.Revision=${toolchain.android.emulatorVersion}`),
  );
  const systemImage = await readFile(
    path.join(
      sdk,
      `system-images/android-${api}/${image.target}/${image.abi}/source.properties`,
    ),
    'utf8',
  );
  assert.match(
    systemImage,
    new RegExp(`Pkg.Revision\\s*=\\s*${image.revision}(?:\\.0)?\\s*$`, 'm'),
  );
  const maestro = await command(process.env.MAESTRO_BINARY ?? 'maestro', [
    '--version',
  ]);
  assert(maestro.includes(toolchain.maestro.version));
  return {
    api,
    abi,
    avd,
    configuredRamMiB: 2048,
    guestMemoryKiB,
    emulator,
    systemImage,
    maestro,
    androidRelease: await adb('shell', 'getprop', 'ro.build.version.release'),
    display: await adb('shell', 'wm', 'size'),
    density: await adb('shell', 'wm', 'density'),
    fontScale: await adb('shell', 'settings', 'get', 'system', 'font_scale'),
    cpuConfiguration: configuration
      .split('\n')
      .filter((line) => /^hw\.(cpu|ramSize)/.test(line)),
    host: `${process.platform}/${process.arch}`,
    hostRunner: process.env.RUNNER_OS ?? 'local',
  };
}
