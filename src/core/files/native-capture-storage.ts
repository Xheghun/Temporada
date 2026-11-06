import { File, Directory, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { digest, CryptoDigestAlgorithm, randomUUID } from 'expo-crypto';
import { z } from 'zod';
import { CaptureError } from './upload-file-store.ts';
import type { CaptureStorage, SelectedImage } from './upload-file-store.ts';
import type { DurableUpload } from '../offline/domain/types.ts';
const journalSchema = z.object({
  sourceUri: z.string(),
  outputs: z.array(z.string()),
});
function workerRoot(workerId: string): Directory {
  if (!/^[a-zA-Z0-9_-]+$/.test(workerId))
    throw new CaptureError('file_ownership_invalid');
  return new Directory(Paths.document, 'workers', workerId, 'uploads');
}
function isInside(uri: string, root: string): boolean {
  const prefix = root.replace(/\/$/, '') + '/';
  if (!uri.startsWith(prefix) || /[?#\\]/.test(uri)) return false;
  return !uri
    .slice(prefix.length)
    .split('/')
    .some((segment) => {
      try {
        return (
          ['.', '..'].includes(decodeURIComponent(segment)) ||
          decodeURIComponent(segment).includes('/')
        );
      } catch {
        return true;
      }
    });
}
function deleteCacheCopy(uri: string): void {
  // Picker copies belong to our cache; gallery originals/content-provider URIs never do.
  if (!isInside(uri, Paths.cache.uri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
async function inspect(workerId: string, uri: string) {
  if (!nativeCaptureStorage.owns(workerId, uri))
    throw new CaptureError('file_ownership_invalid');
  try {
    const file = new File(uri);
    if (!file.exists) throw new CaptureError('local_file_missing');
    const bytes = await file.bytes();
    const hashed = await digest(
      CryptoDigestAlgorithm.SHA256,
      new Uint8Array(bytes),
    );
    return {
      byteSize: bytes.length,
      sha256: Array.from(new Uint8Array(hashed), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
    };
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    throw new CaptureError('local_file_unreadable');
  }
}
export const nativeCaptureStorage: CaptureStorage = {
  owns(workerId, uri) {
    const root = workerRoot(workerId).uri.replace(/\/$/, '') + '/';
    return (
      uri.startsWith(root) &&
      /^capture-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.jpg$/.test(
        uri.slice(root.length),
      )
    );
  },
  inspect,
  async discardSelectedImage(image) {
    deleteCacheCopy(image.uri);
  },
  async prepare(
    workerId: string,
    selected: SelectedImage,
  ): Promise<DurableUpload> {
    const root = workerRoot(workerId);
    root.create({ intermediates: true, idempotent: true });
    const journalDirectory = new Directory(
      Paths.document,
      'capture-journals',
      workerId,
    );
    journalDirectory.create({ intermediates: true, idempotent: true });
    const fileId = randomUUID().toLowerCase();
    const journal = new File(journalDirectory, fileId + '.json');
    const destination = new File(root, `capture-${fileId}.jpg`);
    const outputs: string[] = [];
    const writeJournal = async () => {
      try {
        await journal.write(
          JSON.stringify({ sourceUri: selected.uri, outputs }),
        );
      } catch {
        throw new CaptureError('capture_storage_failed');
      }
    };
    await writeJournal();
    try {
      if (
        !Number.isFinite(selected.width) ||
        !Number.isFinite(selected.height) ||
        selected.width <= 0 ||
        selected.height <= 0
      )
        throw new CaptureError('capture_compression_failed');
      for (const [maximumDimension, quality] of [
        [1600, 0.8],
        [1280, 0.65],
        [960, 0.5],
        [720, 0.35],
      ] as const) {
        const context = ImageManipulator.manipulate(selected.uri);
        try {
          if (Math.max(selected.width, selected.height) > maximumDimension)
            context.resize(
              selected.width >= selected.height
                ? { width: maximumDimension }
                : { height: maximumDimension },
            );
          const image = await context.renderAsync();
          try {
            const result = await image.saveAsync({
              format: SaveFormat.JPEG,
              compress: quality,
            });
            outputs.push(result.uri);
            await writeJournal();
            const compressed = new File(result.uri);
            if (compressed.size > 0 && compressed.size < 1_500_000) {
              try {
                await compressed.copy(destination);
              } catch {
                throw new CaptureError('capture_storage_failed');
              }
              const verified = await inspect(workerId, destination.uri);
              if (verified.byteSize <= 0 || verified.byteSize >= 1_500_000)
                throw new CaptureError('upload_too_large');
              // Only successfully copied, measured bytes can leave this adapter.
              return { workerId, uri: destination.uri, ...verified };
            }
          } finally {
            image.release();
          }
        } finally {
          context.release();
        }
      }
      throw new CaptureError('upload_too_large');
    } catch (error) {
      if (destination.exists) destination.delete();
      throw error instanceof CaptureError
        ? error
        : new CaptureError('capture_compression_failed');
    } finally {
      // A crash leaves the private journal for worker-scoped temporary-file recovery.
      try {
        deleteCacheCopy(selected.uri);
        outputs.forEach(deleteCacheCopy);
        if (journal.exists) journal.delete();
      } catch {
        throw new CaptureError('capture_cleanup_failed');
      }
    }
  },
  async list(workerId) {
    const root = workerRoot(workerId);
    if (!root.exists) return [];
    return root
      .list()
      .filter(
        (entry) =>
          entry instanceof File &&
          nativeCaptureStorage.owns(workerId, entry.uri),
      )
      .map((entry) => entry.uri);
  },
  async remove(workerId, uri) {
    if (!nativeCaptureStorage.owns(workerId, uri))
      throw new CaptureError('file_ownership_invalid');
    const file = new File(uri);
    if (file.exists) file.delete();
  },
  async recoverTemporaryFiles(workerId) {
    workerRoot(workerId);
    const root = new Directory(Paths.document, 'capture-journals', workerId);
    if (!root.exists) return;
    let cleanupFailed = false;
    const quarantine = async (entry: File) => {
      const directory = new Directory(root, 'quarantine');
      directory.create({ intermediates: true, idempotent: true });
      const name = entry.uri.slice(entry.uri.lastIndexOf('/') + 1);
      // Preserve opaque metadata; never infer upload/cache ownership from a partial journal. M2/M7.
      await entry.move(new File(directory, `${name}.${randomUUID()}.invalid`));
    };
    for (const entry of root.list()) {
      if (!(entry instanceof File) || !entry.uri.endsWith('.json')) continue;
      try {
        const text = await entry.text();
        let decoded: unknown;
        try {
          decoded = JSON.parse(text);
        } catch {
          await quarantine(entry);
          continue;
        }
        const parsed = journalSchema.safeParse(decoded);
        if (!parsed.success) {
          await quarantine(entry);
          continue;
        }
        deleteCacheCopy(parsed.data.sourceUri);
        parsed.data.outputs.forEach(deleteCacheCopy);
        entry.delete();
      } catch {
        // Preserve unreadable/unmovable metadata for retry, but still inspect the remaining journals.
        cleanupFailed = true;
      }
    }
    if (cleanupFailed) throw new CaptureError('capture_cleanup_failed');
  },
};
