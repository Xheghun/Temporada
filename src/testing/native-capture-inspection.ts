import { Directory, File, Paths } from 'expo-file-system';
import type { Database } from '../core/database/connection';
import { workerRepository } from '../core/database/expo-database';
import { nativeCaptureStorage } from '../core/files/native-capture-storage';
import { isNativeInspectionAllowed } from '../core/config/native-runtime-policy';
import { readInspectionModel } from './inspection-model';

function countFiles(directory: Directory): number {
  if (!directory.exists) return 0;
  return directory
    .list()
    .reduce(
      (count, entry) =>
        count + (entry instanceof Directory ? countFiles(entry) : 1),
      0,
    );
}

/** Read-only, worker-scoped inspection on the runtime's serialized database handle. */
export async function inspectNativeCapture(
  database: Database,
  workerId: string,
): Promise<string> {
  if (!isNativeInspectionAllowed()) throw new Error('development_only');
  const repository = workerRepository(database, workerId);
  const report = await readInspectionModel(workerId, {
    async readView() {
      const snapshot = await repository.readDetailedView();
      return { ...snapshot.view, submissions: snapshot.submissions };
    },
    now: Date.now,
    async inspectFile(action) {
      const ownsPrivateFile =
        !!action.fileUri && nativeCaptureStorage.owns(workerId, action.fileUri);
      const exists =
        ownsPrivateFile && !!action.fileUri && new File(action.fileUri).exists;
      const measured =
        exists && action.fileUri
          ? await nativeCaptureStorage.inspect(workerId, action.fileUri)
          : null;
      return {
        ownsPrivateFile,
        exists,
        bytes: measured?.byteSize ?? null,
        digest: measured?.sha256 ?? null,
        digestMatches:
          measured && action.payload.kind === 'document_upload'
            ? measured.sha256 === action.payload.sha256
            : null,
      };
    },
    async countFiles() {
      const journals = new Directory(
        Paths.document,
        'capture-journals',
        workerId,
      );
      return {
        managedFiles: (await nativeCaptureStorage.list(workerId)).length,
        journals: journals.exists
          ? journals
              .list()
              .filter(
                (entry) => entry instanceof File && entry.uri.endsWith('.json'),
              ).length
          : 0,
        quarantinedJournals: countFiles(new Directory(journals, 'quarantine')),
        pickerCacheFiles: countFiles(new Directory(Paths.cache, 'ImagePicker')),
      };
    },
  });
  return JSON.stringify(report, null, 2);
}
