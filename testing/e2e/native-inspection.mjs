import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const marker = /TEMPORADA_NATIVE_INSPECTION=(\{[^\r\n]*\})/;
async function readDriverReport(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const report = await readDriverReport(filename);
      if (report) return report;
    } else if (entry.name === 'maestro.log') {
      const report = marker.exec(await readFile(filename, 'utf8'))?.[1];
      if (report) return report;
    }
  }
  return null;
}

/** Copy the real read-only UI report through the same native driver as UI assertions. */
export async function inspectNative({ flow, workerId = 'ana' }) {
  const execution = await flow('media-inspect', { WORKER_ID: workerId });
  const text =
    marker.exec(execution.stdout)?.[1] ??
    (await readDriverReport(execution.artifactDirectory));
  assert(text, 'Native inspection text is missing from the driver output');
  const report = JSON.parse(text);
  assert.equal(report.workerId, workerId);
  assert(
    Array.isArray(report.actions) && Array.isArray(report.submissions),
    'Incomplete native inspection report',
  );
  return report;
}
