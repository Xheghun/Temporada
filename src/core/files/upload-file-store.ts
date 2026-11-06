import type { DurableUpload, OutboxAction } from '../offline/domain/types.ts';
export interface SelectedImage {
  uri: string;
  width: number;
  height: number;
}
export class CaptureError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export interface CaptureStorage {
  prepare(workerId: string, image: SelectedImage): Promise<DurableUpload>;
  discardSelectedImage(image: SelectedImage): Promise<void>;
  inspect(
    workerId: string,
    uri: string,
  ): Promise<{ byteSize: number; sha256: string }>;
  list(workerId: string): Promise<string[]>;
  remove(workerId: string, uri: string): Promise<void>;
  owns(workerId: string, uri: string): boolean;
  recoverTemporaryFiles(workerId: string): Promise<void>;
}
export interface FileReferences {
  actions(workerId: string): Promise<OutboxAction[]>;
  fail(workerId: string, actionId: string, code: string): Promise<void>;
}
/** One gate covers prepare/preview leases, enqueue and recovery. File/SQLite operations are compensated, not atomic. */
export class UploadFileStore {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly previews = new Set<string>();
  private readonly storage: CaptureStorage;
  private readonly references: FileReferences;
  constructor(storage: CaptureStorage, references: FileReferences) {
    this.storage = storage;
    this.references = references;
  }
  private exclusive<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  prepare(workerId: string, image: SelectedImage): Promise<DurableUpload> {
    return this.exclusive(async () => {
      const file = await this.storage.prepare(workerId, image);
      if (file.workerId !== workerId)
        throw new CaptureError('file_ownership_invalid');
      try {
        await this.verify(file);
      } catch (error) {
        await this.removeIfUnreferenced(file);
        throw error;
      }
      this.previews.add(file.uri);
      return file;
    });
  }
  discardSelection(image: SelectedImage): Promise<void> {
    return this.exclusive(() => this.storage.discardSelectedImage(image));
  }
  private async verify(file: DurableUpload): Promise<void> {
    if (!this.storage.owns(file.workerId, file.uri))
      throw new CaptureError('file_ownership_invalid');
    const actual = await this.storage.inspect(file.workerId, file.uri);
    if (actual.byteSize <= 0 || actual.byteSize >= 1_500_000)
      throw new CaptureError('upload_too_large');
    if (actual.byteSize !== file.byteSize || actual.sha256 !== file.sha256)
      throw new CaptureError('local_file_changed');
  }
  async discard(file: DurableUpload): Promise<void> {
    return this.exclusive(async () => {
      if (!this.storage.owns(file.workerId, file.uri))
        throw new CaptureError('file_ownership_invalid');
      this.previews.delete(file.uri);
      await this.removeIfUnreferenced(file);
    });
  }
  private async removeIfUnreferenced(file: DurableUpload): Promise<void> {
    // Query failure keeps bytes. An ambiguous commit must never destroy the only upload copy. M2.
    const actions = await this.references.actions(file.workerId);
    if (!actions.some((action) => action.fileUri === file.uri))
      await this.storage.remove(file.workerId, file.uri);
  }
  commit(
    file: DurableUpload,
    enqueue: () => Promise<string | null>,
  ): Promise<string> {
    return this.exclusive(async () => {
      if (!this.storage.owns(file.workerId, file.uri))
        throw new CaptureError('file_ownership_invalid');
      let verified = false;
      try {
        await this.verify(file);
        verified = true;
        const actionId = await enqueue();
        if (actionId) {
          this.previews.delete(file.uri);
          return actionId;
        }
        throw new CaptureError('capture_save_failed');
      } catch (error) {
        this.previews.delete(file.uri);
        const existing = (await this.references.actions(file.workerId)).find(
          (action) => action.fileUri === file.uri,
        );
        if (existing && verified) return existing.id;
        if (existing) throw error;
        await this.storage.remove(file.workerId, file.uri);
        throw error;
      }
    });
  }
  reconcile(workerId: string): Promise<void> {
    return this.exclusive(async () => {
      await this.storage.recoverTemporaryFiles(workerId);
      const actions = await this.references.actions(workerId);
      const keep = new Set<string>();
      for (const action of actions) {
        if (!action.fileUri || !this.storage.owns(workerId, action.fileUri))
          continue;
        if (!['delivered', 'superseded'].includes(action.status))
          keep.add(action.fileUri);
        // Never interrupt an in-flight request; dispatch independently verifies its snapshot.
        if (
          action.payload.kind === 'document_upload' &&
          ['queued', 'retry_wait'].includes(action.status)
        ) {
          try {
            const actual = await this.storage.inspect(workerId, action.fileUri);
            if (actual.byteSize <= 0 || actual.byteSize >= 1_500_000)
              throw new CaptureError('upload_too_large');
            if (actual.sha256 !== action.payload.sha256)
              throw new CaptureError('local_file_changed');
          } catch (error) {
            if (!(error instanceof CaptureError)) throw error;
            await this.references.fail(workerId, action.id, error.code);
          }
        }
      }
      for (const uri of await this.storage.list(workerId))
        if (!keep.has(uri) && !this.previews.has(uri))
          await this.storage.remove(workerId, uri);
    });
  }
  settled(): Promise<unknown> {
    return this.tail;
  }
}
