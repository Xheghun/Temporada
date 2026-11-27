import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';
import { runMediaJourney } from './media-journey.mjs';

export async function runScenarioFive(context) {
  const { flow, output } = context;
  const device = androidDevice(context);
  const translations = JSON.parse(
    await readFile('src/core/i18n/es.json', 'utf8'),
  );
  const code = process.env.E2E_REJECTION === '422' ? 422 : 413;
  const labels = {
    CAMERA_LABEL: translations.capture.camera,
    GALLERY_LABEL: translations.capture.gallery,
    PREVIEW_LABEL: translations.capture.preview,
    SAVE_LABEL: translations.capture.save,
    PENDING_LABEL: translations.documents.status.pending_sync,
  };
  return runMediaJourney({
    ...context,
    language: 'es',
    includeGallery: false,
    expectedActionCount: 2,
    async beforeCapture() {
      await flow('terms-confirm', {
        VERSION_LABEL: translations.terms.version.replace('{{version}}', 'v2'),
        TERMS_PENDING_LABEL: translations.terms.status.pending_sync,
      });
    },
    async afterSave(before) {
      const original = before.actions.find(
        (action) => action.actionType === 'document_upload',
      );
      const terms = before.actions.find(
        (action) => action.actionType === 'terms_acceptance',
      );
      await fixtureRequest('/__dev/failures', {
        [code === 413 ? 'force413' : 'force422']: true,
      });
      await device.online();
      const rejected = await waitForObservation(
        'permanent rejection with unrelated terms delivered',
        () => inspectNative(context),
        (inspection) =>
          inspection.actions.some(
            (action) =>
              action.clientActionId === original.clientActionId &&
              action.status === 'failed_permanent',
          ) &&
          inspection.actions.some(
            (action) =>
              action.clientActionId === terms.clientActionId &&
              action.status === 'delivered',
          ),
      );
      const failed = rejected.actions.find(
        (action) => action.clientActionId === original.clientActionId,
      );
      assert.equal(
        failed.lastErrorCode,
        code === 413 ? 'upload_too_large' : 'invalid_upload',
      );
      await flow('upload-error', {
        ERROR_LABEL:
          code === 413
            ? translations.documents.sizeError
            : translations.documents.validationError,
      });
      const traceBefore = await fixtureRequest('/__dev/trace');
      const attemptsBefore = traceBefore.entries.filter(
        (attempt) => attempt.clientActionId === original.clientActionId,
      );
      assert.equal(attemptsBefore.length, 1);
      assert.equal(attemptsBefore[0].status, code);
      const observationStarted = performance.now();
      // A measured observation interval checks that a permanent error schedules no retry.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const observationMs = performance.now() - observationStarted;
      const traceAfter = await fixtureRequest('/__dev/trace');
      assert.equal(
        traceAfter.entries.filter(
          (attempt) => attempt.clientActionId === original.clientActionId,
        ).length,
        1,
      );
      await device.offline();
      await fixtureRequest('/__dev/failures', {
        force413: false,
        force422: false,
      });
      await flow('media-open-passport', labels);
      await flow('media-camera', labels);
      await flow('media-save', labels);
      const replacement = await inspectNative(context);
      const fresh = replacement.actions.find(
        (action) =>
          action.actionType === 'document_upload' &&
          action.clientActionId !== original.clientActionId,
      );
      assert(fresh, 'Explicit retake did not create a new action');
      assert.equal(fresh.status, 'queued');
      assert.notEqual(fresh.submissionId, original.submissionId);
      assert.equal(fresh.replacesSubmissionId, original.replacesSubmissionId);
      assert.equal(
        replacement.actions.find(
          (action) => action.clientActionId === original.clientActionId,
        )?.status,
        'superseded',
      );
      assert.equal(fresh.exists, true);
      assert.equal(fresh.ownsPrivateFile, true);
      assert.equal(fresh.digestMatches, true);
      assert(fresh.bytes > 0 && fresh.bytes < 1_500_000);
      await device.online();
      const delivered = await waitForObservation(
        'replacement delivery',
        () => inspectNative(context),
        (inspection) =>
          inspection.actions.some(
            (action) =>
              action.clientActionId === fresh.clientActionId &&
              action.status === 'delivered',
          ),
      );
      const server = await fixtureRequest('/__dev/state');
      assert.equal(
        server.receipts.filter(
          (receipt) =>
            receipt.workerId === 'ana' &&
            receipt.clientActionId === original.clientActionId,
        ).length,
        0,
      );
      assert.equal(
        server.receipts.filter(
          (receipt) =>
            receipt.workerId === 'ana' &&
            receipt.clientActionId === fresh.clientActionId,
        ).length,
        1,
      );
      assert.equal(
        server.acceptances.filter((acceptance) => acceptance.workerId === 'ana')
          .length,
        1,
      );
      assert.equal(
        server.documentSubmissions.filter(
          (submission) => submission.workerId === 'ana',
        ).length,
        1,
      );
      await flow('upload-pending-review', {
        REVIEW_LABEL: translations.documents.status.pending_review,
      });
      await writeFile(
        path.join(output, 'scenario-5.json'),
        JSON.stringify(
          {
            status: 'PASS',
            code,
            requirements: ['M3', 'M5', 'M7', 'M8', 'M9'],
            tests: ['TEST-04'],
            observationMs,
            before,
            rejected,
            replacement,
            delivered,
            server,
            traceBefore,
            traceAfter,
          },
          null,
          2,
        ),
      );
    },
  });
}
