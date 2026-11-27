import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createMediaFixture } from './media-fixture.mjs';

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

export async function runMediaJourney({
  adb,
  flow,
  output,
  temporaryDirectory,
  language,
}) {
  const translations = JSON.parse(
    await readFile(`src/core/i18n/${language}.json`, 'utf8'),
  );
  const labels = {
    CAMERA_LABEL: translations.capture.camera,
    GALLERY_LABEL: translations.capture.gallery,
    PREVIEW_LABEL: translations.capture.preview,
    SAVE_LABEL: translations.capture.save,
    PENDING_LABEL: translations.documents.status.pending_sync,
  };
  const filename = `fictional-${randomUUID()}.png`;
  const local = path.join(temporaryDirectory, filename);
  const shared = `/sdcard/Pictures/TemporadaE2E/${filename}`;
  const hierarchy = `/data/local/tmp/temporada-e2e-${randomUUID()}.xml`;
  const fixture = await createMediaFixture(local);
  assert(
    fixture.bytes > 1_500_000,
    'Fixture must exercise large-image processing',
  );
  let originalFailure;
  try {
    await adb('shell', 'mkdir', '-p', '/sdcard/Pictures/TemporadaE2E');
    await adb('push', local, shared);
    await adb(
      'shell',
      'am',
      'broadcast',
      '-a',
      'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
      '-d',
      `file://${shared}`,
    );
    await adb(
      'shell',
      'pm',
      'grant',
      'com.cremedigital.seasonalworker.e2e',
      'android.permission.CAMERA',
    );
    await adb(
      'shell',
      'pm',
      'grant',
      'com.android.camera2',
      'android.permission.CAMERA',
    );
    if (language === 'en') await flow('media-english');
    await flow('probe-airplane');
    await adb('shell', 'svc', 'wifi', 'disable');
    await flow('media-open-passport', labels);
    await flow('media-camera', labels);
    // Exercise retake before saving the first real submission.
    await flow('media-camera', labels);
    await flow('media-save', labels);
    await flow('media-gallery', labels);
    await flow('media-save', labels);
    await flow('media-inspect');
    await adb('shell', 'uiautomator', 'dump', hierarchy);
    const xml = await adb('exec-out', 'cat', hierarchy);
    const node = xml
      .match(/<node\b[^>]*>/g)
      ?.find((candidate) =>
        /resource-id="[^"]*capture-inspection-report"/.test(candidate),
      );
    const text = node?.match(/\btext="([^"]*)"/)?.[1];
    assert(text, 'Native inspection text is missing');
    const inspection = JSON.parse(decodeXml(text));
    assert.equal(inspection.workerId, 'ana');
    assert.equal(inspection.actions.length, 2);
    assert.equal(inspection.managedFiles, 2);
    assert.equal(inspection.pickerCacheFiles, 0);
    assert.equal(inspection.journals, 0);
    for (const action of inspection.actions) {
      assert.equal(action.status, 'queued');
      assert.equal(action.exists, true);
      assert.equal(action.digestMatches, true);
      assert(action.bytes > 0 && action.bytes < 1_500_000);
    }
    const sharedHash = (await adb('shell', 'sha256sum', shared)).split(
      /\s+/,
    )[0];
    assert.equal(
      sharedHash,
      fixture.sha256,
      'User-owned gallery original changed',
    );
    await writeFile(
      path.join(output, 'native-capture.json'),
      JSON.stringify(
        { language, fixture, inspection, galleryOriginalIntact: true },
        null,
        2,
      ),
    );
    return {
      language,
      fixtureBytes: fixture.bytes,
      privateUploads: inspection.actions.length,
    };
  } catch (error) {
    originalFailure = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    for (const cleanup of [
      () => adb('shell', 'rm', '-f', shared, hierarchy),
      () =>
        adb(
          'shell',
          'am',
          'broadcast',
          '-a',
          'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
          '-d',
          `file://${shared}`,
        ),
    ]) {
      try {
        await cleanup();
      } catch (error) {
        cleanupErrors.push(String(error));
      }
    }
    await writeFile(
      path.join(output, 'media-cleanup.json'),
      JSON.stringify(
        {
          status: cleanupErrors.length ? 'FAIL' : 'PASS',
          errors: cleanupErrors,
        },
        null,
        2,
      ),
    );
    if (cleanupErrors.length)
      throw new Error(
        [originalFailure ? String(originalFailure) : '', ...cleanupErrors]
          .filter(Boolean)
          .join('\n'),
      );
  }
}
