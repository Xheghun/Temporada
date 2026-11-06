import { Blob as ExpoBlob } from 'expo-blob';
import { File, Directory, Paths } from 'expo-file-system';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import type { UploadResolver } from '../api/client.ts';
import { TransportError } from '../sync/types.ts';

/** Dispatch-time integrity check. Capture still owns copying, compression and orphan recovery. */
// SDK 58's ExpoBlob bytes() predates TypeScript 6's stricter ArrayBuffer generics.
// Normalize returned buffers without casting across the platform Blob contract.
class UploadBlob extends ExpoBlob {
  override async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await super.bytes());
  }
  override slice(start?: number, end?: number, type?: string): UploadBlob {
    return new UploadBlob(
      [super.slice(start, end, type)],
      type === undefined ? undefined : { type },
    );
  }
}

export const uploadResolver: UploadResolver = {
  async resolve(action) {
    try {
      if (
        action.payload.kind !== 'document_upload' ||
        !action.fileUri ||
        !/^[a-zA-Z0-9_-]+$/.test(action.workerId)
      )
        throw new TransportError(422, 'invalid_local_file');
      const root =
        new Directory(
          Paths.document,
          'workers',
          action.workerId,
          'uploads',
        ).uri.replace(/\/$/, '') + '/';
      const relative = action.fileUri.slice(root.length);
      if (
        !action.fileUri.startsWith(root) ||
        !/^[a-zA-Z0-9_.-]+$/.test(relative) ||
        relative === '..'
      )
        throw new TransportError(422, 'file_ownership_invalid');
      const file = new File(action.fileUri);
      if (!file.exists) throw new TransportError(422, 'local_file_missing');
      if (file.size <= 0 || file.size >= 1_500_000)
        throw new TransportError(413, 'upload_too_large');
      // Snapshot the bytes used for both the digest and upload; no second mutable file read.
      const bytes = await file.bytes();
      if (bytes.length <= 0 || bytes.length >= 1_500_000)
        throw new TransportError(413, 'upload_too_large');
      const hashed = await digest(
        CryptoDigestAlgorithm.SHA256,
        new Uint8Array(bytes),
      );
      const sha256 = Array.from(new Uint8Array(hashed), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');
      if (sha256 !== action.payload.sha256.toLowerCase())
        throw new TransportError(422, 'local_file_changed');
      const mime =
        bytes[0] === 137
          ? 'image/png'
          : bytes[0] === 255
            ? 'image/jpeg'
            : 'image/webp';
      return new UploadBlob([new Uint8Array(bytes)], { type: mime });
    } catch (error) {
      if (error instanceof TransportError) throw error;
      throw new TransportError(422, 'local_file_unreadable');
    }
  },
};
