import { Directory, File, Paths } from 'expo-file-system';
import {
  openWorkerDatabase,
  workerRepository,
} from '../core/database/expo-database';
import { nativeCaptureStorage } from '../core/files/native-capture-storage';
/** Read-only assessment probe: IDs/counts/integrity only; never tokens, image bytes or private URIs. */
export async function inspectNativeCapture(workerId: string): Promise<string> {
  if (!__DEV__ || process.env.EXPO_PUBLIC_ASSESSMENT_MODE !== '1')
    throw new Error('development_only');
  const database = await openWorkerDatabase();
  try {
    const actions = await workerRepository(database, workerId).listActions();
    const rows = [];
    for (const action of actions) {
      if (
        action.payload.kind !== 'document_upload' ||
        !action.fileUri ||
        !nativeCaptureStorage.owns(workerId, action.fileUri)
      )
        continue;
      const exists = new File(action.fileUri).exists;
      const measured = exists
        ? await nativeCaptureStorage.inspect(workerId, action.fileUri)
        : null;
      rows.push({
        actionId: action.id,
        documentType: action.payload.documentType,
        status: action.status,
        exists,
        bytes: measured?.byteSize ?? null,
        digestMatches: measured
          ? measured.sha256 === action.payload.sha256
          : null,
      });
    }
    const journals = new Directory(
      Paths.document,
      'capture-journals',
      workerId,
    );
    const picker = new Directory(Paths.cache, 'ImagePicker');
    return JSON.stringify(
      {
        workerId,
        actions: rows,
        managedFiles: (await nativeCaptureStorage.list(workerId)).length,
        journals: journals.exists ? journals.list().length : 0,
        pickerCacheFiles: picker.exists
          ? picker.list().filter((entry) => entry instanceof File).length
          : 0,
      },
      null,
      2,
    );
  } finally {
    await database.close();
  }
}
