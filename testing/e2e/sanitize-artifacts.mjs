import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve(process.env.E2E_OUTPUT ?? 'e2e-results/native');
async function visit(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(filename);
    else if (
      ['device-logcat.txt', 'device-simulator.log'].includes(entry.name)
    ) {
      const lines = (await readFile(filename, 'utf8')).split('\n');
      const filtered = lines
        .filter((line) =>
          /AndroidRuntime|FATAL EXCEPTION|ANR in com\.cremedigital\.seasonalworker\.e2e|TemporadaE2E|com\.cremedigital\.seasonalworker\.e2e|securityd.*(?:34018|entitlements)/.test(
            line,
          ),
        )
        .slice(-500);
      await writeFile(
        filename,
        filtered
          .join('\n')
          .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
          .replace(
            /(?:file:\/\/|\/data\/user\/|\/data\/data\/|\/Users\/[^\s]+\/CoreSimulator\/Devices\/)\S+/g,
            '[private path]',
          ),
      );
    }
  }
}
await visit(output);
