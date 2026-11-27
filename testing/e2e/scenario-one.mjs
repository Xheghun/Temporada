import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { androidDevice } from './android-device.mjs';
import { inspectNative } from './native-inspection.mjs';
import { fixtureRequest, waitForObservation } from './mock-client.mjs';
import { runMediaJourney } from './media-journey.mjs';

export async function runScenarioOne(context) {
  const { flow, output } = context;
  const device = androidDevice(context);
  const english = JSON.parse(await readFile('src/core/i18n/en.json', 'utf8'));
  const labels = {
    CAMERA_LABEL: english.capture.camera,
    GALLERY_LABEL: english.capture.gallery,
    PREVIEW_LABEL: english.capture.preview,
    SAVE_LABEL: english.capture.save,
    PENDING_LABEL: english.documents.status.pending_sync,
  };
  const homeLabels = {
    GREETING_LABEL: english.ui.greeting.replace('{{name}}', 'Ana López'),
    LANGUAGE_LABEL: english.ui.language,
  };
  await flow('language-spanish');
  return runMediaJourney({
    ...context,
    language: 'en',
    includeGallery: false,
    expectedActionCount: 2,
    async beforeCapture() {
      await flow('language-screens', {
        ...homeLabels,
        OFFLINE_LABEL: english.home.offline,
        TERMS_TITLE: english.reference.beforeBegin,
        TERMS_VERSION: english.terms.version.replace('{{version}}', 'v2'),
        DOCUMENTS_TITLE: english.documents.title,
      });
      await flow('terms-confirm', {
        VERSION_LABEL: english.terms.version.replace('{{version}}', 'v2'),
        TERMS_PENDING_LABEL: english.terms.status.pending_sync,
      });
    },
    async afterSave(queued) {
      await fixtureRequest('/__dev/failures', {
        serverErrorRate: 1,
        randomSeed: 281,
      });
      await device.online();
      const retry = await waitForObservation(
        'real English retry state',
        () => inspectNative(context),
        (inspection) =>
          inspection.actions.some(
            (action) =>
              action.actionType === 'terms_acceptance' &&
              action.status === 'retry_wait',
          ),
      );
      await flow('language-retry', { RETRY_LABEL: english.ui.retry });
      await fixtureRequest('/__dev/failures', {
        serverErrorRate: 0,
        force413: true,
      });
      const rejected = await waitForObservation(
        'English permanent rejection',
        () => inspectNative(context),
        (inspection) =>
          inspection.actions.some(
            (action) =>
              action.actionType === 'document_upload' &&
              action.status === 'failed_permanent',
          ),
      );
      await flow('upload-error', { ERROR_LABEL: english.documents.sizeError });
      await device.offline();
      await fixtureRequest('/__dev/failures', { force413: false });
      await flow('media-open-passport', labels);
      await flow('media-camera', labels);
      await flow('media-save', labels);
      const replacement = await inspectNative(context);
      const original = queued.actions.find(
        (action) => action.actionType === 'document_upload',
      );
      const fresh = replacement.actions.find(
        (action) =>
          action.actionType === 'document_upload' &&
          action.clientActionId !== original.clientActionId,
      );
      assert(fresh && fresh.exists && fresh.digestMatches);
      await device.online();
      await waitForObservation(
        'English replacement delivery',
        () => inspectNative(context),
        (inspection) =>
          inspection.actions.some(
            (action) =>
              action.clientActionId === fresh.clientActionId &&
              action.status === 'delivered',
          ),
      );
      const state = await fixtureRequest('/__dev/state');
      const submission = state.documentSubmissions.find(
        (submission) =>
          submission.workerId === 'ana' &&
          submission.clientActionId === fresh.clientActionId,
      );
      assert(submission);
      const reason = 'Foto borrosa, vuelva a tomarla';
      const review = await fixtureRequest('/__dev/review', {
        submissionId: submission.submissionId,
        status: 'correction_requested',
        correctionReason: reason,
      });
      await flow('review-refresh');
      await waitForObservation(
        'verbatim staff review',
        () => inspectNative(context),
        (inspection) =>
          inspection.submissions.some(
            (candidate) =>
              candidate.serverSubmissionId === submission.submissionId &&
              candidate.serverRevision === review.serverRevision &&
              candidate.correctionReason === reason,
          ),
      );
      await flow('correction-reason', {
        REASON_LABEL: english.documents.reason.replace('{{reason}}', reason),
      });
      await device.forceStop();
      await device.relaunch();
      await flow('language-restored', homeLabels);
      await flow('correction-reason', {
        REASON_LABEL: english.documents.reason.replace('{{reason}}', reason),
      });
      const restored = await inspectNative(context);
      await writeFile(
        path.join(output, 'scenario-1.json'),
        JSON.stringify(
          {
            status: 'PASS',
            requirements: ['M9'],
            coveredStates: [
              'default Spanish',
              'English Home',
              'English Terms',
              'English Documents',
              'English Capture and preview accessibility',
              'queued',
              'retry',
              '413 recovery',
              'review reason verbatim',
              'saved locale after force-stop',
            ],
            queued,
            retry,
            rejected,
            replacement,
            restored,
            review,
            trace: await fixtureRequest('/__dev/trace'),
          },
          null,
          2,
        ),
      );
    },
  });
}
