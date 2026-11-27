import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { crc32, deflateSync } from 'node:zlib';

/** Reproducible colored noise, containing no document or personal information. */
export async function createMediaFixture(filename) {
  const width = 1920,
    height = 2560;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  let seed = 35;
  for (let row = 0; row < height; row++) {
    const offset = row * (width * 3 + 1);
    for (let column = 1; column <= width * 3; column++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels[offset + column] = seed >>> 24;
    }
  }
  function chunk(type, bytes) {
    const name = Buffer.from(type);
    const result = Buffer.alloc(bytes.length + 12);
    result.writeUInt32BE(bytes.length);
    name.copy(result, 4);
    bytes.copy(result, 8);
    result.writeUInt32BE(crc32(Buffer.concat([name, bytes])), bytes.length + 8);
    return result;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const image = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels, { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  await writeFile(filename, image);
  return {
    width,
    height,
    bytes: image.length,
    sha256: createHash('sha256').update(image).digest('hex'),
  };
}
