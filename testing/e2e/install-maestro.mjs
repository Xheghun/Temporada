import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const { maestro } = JSON.parse(
  await readFile(new URL('./toolchain.json', import.meta.url), 'utf8'),
);
const root = path.resolve(
  process.env.MAESTRO_INSTALL_ROOT ??
    path.join(
      process.env.RUNNER_TEMP ?? tmpdir(),
      `temporada-maestro-${maestro.version}`,
    ),
);
await mkdir(root, { recursive: true });
const archive = path.join(root, 'maestro.zip');
let bytes;
try {
  bytes = await readFile(archive);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (
  !bytes ||
  createHash('sha256').update(bytes).digest('hex') !== maestro.sha256
) {
  const response = await fetch(maestro.url, {
    signal: AbortSignal.timeout(300_000),
  });
  assert(response.ok, `Maestro download failed: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    maestro.sha256,
    'Maestro archive checksum mismatch',
  );
  await writeFile(archive, bytes);
}
await promisify(execFile)('unzip', ['-q', '-o', archive, '-d', root]);
const bin = path.join(root, 'maestro/bin');
if (process.env.GITHUB_PATH)
  await appendFile(process.env.GITHUB_PATH, `${bin}\n`);
console.log(path.join(bin, 'maestro'));
