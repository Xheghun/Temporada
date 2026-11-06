import { nativeCaptureStorage } from '../core/files/native-capture-storage';
const mockFiles = new Map<string, Uint8Array>();
let mockSizes: number[] = [];
let mockOutput = 0;
let mockCopyFailure = false;
const mockJoin = (parts: (string | { uri: string })[]) =>
  parts
    .map((part) => (typeof part === 'string' ? part : part.uri))
    .reduce(
      (base, part) => (base ? base.replace(/\/$/, '') + '/' + part : part),
      '',
    );
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = mockJoin(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri)?.length ?? 0;
    }
    async bytes() {
      return mockFiles.get(this.uri) ?? new Uint8Array();
    }
    async write(value: string) {
      await Promise.resolve();
      mockFiles.set(this.uri, new Uint8Array(Buffer.from(value)));
    }
    async text() {
      return Buffer.from(mockFiles.get(this.uri) ?? []).toString();
    }
    async copy(destination: File) {
      await Promise.resolve();
      if (mockCopyFailure) throw new Error('disk_full');
      mockFiles.set(
        destination.uri,
        new Uint8Array(mockFiles.get(this.uri) ?? []),
      );
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = mockJoin(parts);
    }
    get exists() {
      return true;
    }
    create() {}
    list() {
      return [...mockFiles.keys()]
        .filter(
          (uri) =>
            uri.startsWith(this.uri + '/') &&
            !uri.slice(this.uri.length + 1).includes('/'),
        )
        .map((uri) => new File(uri));
    }
  }
  return {
    File,
    Directory,
    Paths: {
      cache: { uri: 'file:///cache' },
      document: { uri: 'file:///private' },
    },
  };
});
jest.mock('expo-crypto', () => ({
  randomUUID: () => '11111111-1111-4111-8111-111111111111',
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
  digest: async () => new ArrayBuffer(32),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: () => {},
      release: () => {},
      renderAsync: async () => ({
        release: () => {},
        saveAsync: async () => {
          const uri = `file:///cache/output-${++mockOutput}.jpg`;
          mockFiles.set(uri, new Uint8Array(mockSizes.shift() ?? 100));
          return { uri };
        },
      }),
    }),
  },
}));
beforeEach(() => {
  mockFiles.clear();
  mockSizes = [];
  mockOutput = 0;
  mockCopyFailure = false;
});
test('measures actual output, retries an exact-threshold image, awaits copy and removes app original/temporary copies', async () => {
  mockFiles.set('file:///cache/original.jpg', new Uint8Array(2_000_000));
  mockSizes = [1_500_000, 1_499_999];
  const file = await nativeCaptureStorage.prepare('ana', {
    uri: 'file:///cache/original.jpg',
    width: 3000,
    height: 2000,
  });
  expect(file.byteSize).toBe(1_499_999);
  expect(mockOutput).toBe(2);
  expect(mockFiles.has(file.uri)).toBe(true);
  expect([...mockFiles.keys()]).toEqual([file.uri]);
});
test('gallery-owned original survives successful compression and an uncompressible selection leaves no app output', async () => {
  const uri = 'file:///gallery/original.jpg';
  mockFiles.set(uri, new Uint8Array(2_000_000));
  const file = await nativeCaptureStorage.prepare('ana', {
    uri,
    width: 3000,
    height: 2000,
  });
  expect(mockFiles.has(uri)).toBe(true);
  expect(mockFiles.has(file.uri)).toBe(true);
  mockFiles.delete(file.uri);
  mockSizes = [1_500_000, 1_500_001, 1_500_002, 1_500_003];
  await expect(
    nativeCaptureStorage.prepare('ana', { uri, width: 3000, height: 2000 }),
  ).rejects.toThrow('upload_too_large');
  expect([...mockFiles.keys()]).toEqual([uri]);
});
test('journal recovery deletes only app cache copies, leaves durable destination for DB-aware recovery and ignores other workers', async () => {
  const source = 'file:///cache/original.jpg',
    output = 'file:///cache/output.jpg',
    durable =
      'file:///private/workers/ana/uploads/capture-11111111-1111-4111-8111-111111111111.jpg';
  for (const uri of [source, output, durable, 'file:///gallery/user.jpg'])
    mockFiles.set(uri, new Uint8Array(100));
  mockFiles.set(
    'file:///private/capture-journals/ana/interrupted.json',
    new Uint8Array(
      Buffer.from(
        JSON.stringify({
          sourceUri: source,
          outputs: [output, 'file:///gallery/user.jpg'],
        }),
      ),
    ),
  );
  mockFiles.set(
    'file:///private/capture-journals/bruno/other.json',
    new Uint8Array(Buffer.from('{}')),
  );
  await nativeCaptureStorage.recoverTemporaryFiles('ana');
  expect(mockFiles.has(source)).toBe(false);
  expect(mockFiles.has(output)).toBe(false);
  expect(mockFiles.has(durable)).toBe(true);
  expect(mockFiles.has('file:///gallery/user.jpg')).toBe(true);
  expect(
    mockFiles.has('file:///private/capture-journals/bruno/other.json'),
  ).toBe(true);
});

test('durable copy failure cleans temporary app copies and reports storage recovery without returning a queued file', async () => {
  mockFiles.set('file:///cache/original.jpg', new Uint8Array(1000));
  mockCopyFailure = true;
  await expect(
    nativeCaptureStorage.prepare('ana', {
      uri: 'file:///cache/original.jpg',
      width: 100,
      height: 100,
    }),
  ).rejects.toThrow('capture_storage_failed');
  expect([...mockFiles.keys()]).toEqual([]);
});
