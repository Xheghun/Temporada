import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

function decodeXml(value) {
  return value.replace(
    /&(?:quot|apos|lt|gt|amp);|&#(\d+);|&#x([0-9a-f]+);/gi,
    (entity, decimal, hexadecimal) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal) return String.fromCodePoint(parseInt(hexadecimal, 16));
      return {
        '&quot;': '"',
        '&apos;': "'",
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&',
      }[entity];
    },
  );
}

export async function inspectNative({ adb, flow, output }) {
  const hierarchy = `/data/local/tmp/temporada-e2e-${randomUUID()}.xml`;
  try {
    await flow('media-inspect');
    await adb('shell', 'uiautomator', 'dump', hierarchy);
    const xml = await adb('exec-out', 'cat', hierarchy);
    const nodes = xml.match(/<node\b[^>]*>/g) ?? [];
    const text = nodes
      .flatMap((node) =>
        ['text', 'content-desc'].map((attribute) => {
          const value = node.match(
            new RegExp(`\\b${attribute}="([^"]*)"`),
          )?.[1];
          return value ? decodeXml(value) : '';
        }),
      )
      .find(
        (value) => value.trim().startsWith('{') && value.includes('"workerId"'),
      );
    if (!text)
      await writeFile(
        path.join(output, 'inspection-node-metadata.json'),
        JSON.stringify(
          nodes.map((node) => ({
            resourceId: node.match(/resource-id="([^"]*)"/)?.[1] ?? null,
            textLength: node.match(/\btext="([^"]*)"/)?.[1]?.length ?? 0,
          })),
          null,
          2,
        ),
      );
    assert(text, 'Native inspection text is missing');
    return JSON.parse(text);
  } finally {
    await adb('shell', 'rm', '-f', hierarchy);
  }
}
