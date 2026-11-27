import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);

export async function readSimulatorEntitlements(app) {
  const executable = (
    await execute('/usr/libexec/PlistBuddy', [
      '-c',
      'Print:CFBundleExecutable',
      path.join(app, 'Info.plist'),
    ])
  ).stdout.trim();
  assert.equal(path.basename(executable), executable);
  const binaryPath = path.join(app, executable);
  const binary = await readFile(binaryPath);
  assert.equal(
    binary.readUInt32LE(0),
    0xfeedfacf,
    'Expected a thin 64-bit simulator executable',
  );
  const layout = (await execute('xcrun', ['otool', '-l', binaryPath])).stdout;
  const section =
    /sectname __entitlements\s+segname __TEXT\s+addr \S+\s+size (0x[\da-f]+)\s+offset (\d+)/i.exec(
      layout,
    );
  assert(section, 'Simulator executable has no embedded entitlements');
  const size = Number.parseInt(section[1], 16);
  const offset = Number(section[2]);
  assert(size > 0 && offset >= 0 && offset + size <= binary.length);
  return binary.subarray(offset, offset + size).toString('utf8');
}
