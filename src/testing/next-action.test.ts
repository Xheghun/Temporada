import { nextWorkerAction } from '../features/assignment/domain/next-action';
import {
  documentViews,
  documentPresentationFacts,
  submissionStatusKey,
} from '../features/documents/domain/document-view';
import type {
  WorkerViewData,
  OutboxAction,
} from '../core/offline/domain/types';
import { assignmentFixture } from './persistence-fixtures';
function data(): WorkerViewData {
  const assignment = assignmentFixture('ana');
  assignment.terms.serverAcceptanceStatus = 'accepted';
  return {
    assignment,
    actions: [],
    cachedAt: 1,
    refreshNeeded: false,
    refreshError: null,
  };
}
function upload(
  status: OutboxAction['status'],
  replacesSubmissionId: string | null = null,
): OutboxAction {
  return {
    id: 'new-action',
    clientActionId: 'new-action',
    workerId: 'ana',
    sequence: 1,
    actionType: 'document_upload',
    payload: {
      kind: 'document_upload',
      workerId: 'ana',
      clientActionId: 'new-action',
      localSubmissionId: 'new-action',
      documentType: 'passport',
      sha256: 'a'.repeat(64),
      replacesSubmissionId,
    },
    fileUri: 'file:///private/fictional.jpg',
    status,
    attemptCount: 0,
    nextAttemptAt: 0,
    lastErrorCode: null,
    createdAt: 1,
    updatedAt: 1,
  };
}
function action(value: WorkerViewData) {
  return nextWorkerAction(
    value,
    documentPresentationFacts(documentViews(value)),
    true,
  );
}
test('terms precede corrections, then missing documents precede other failures', () => {
  const value = data();
  value.assignment!.terms.serverAcceptanceStatus = 'not_confirmed';
  value.assignment!.documentSubmissions = [
    {
      submissionId: 'old',
      clientActionId: 'old',
      documentType: 'passport',
      status: 'correction_requested',
      correctionReason: 'Original reason',
      serverRevision: 2,
      createdAt: 1,
    },
  ];
  expect(action(value)).toBe('terms');
  value.assignment!.terms.serverAcceptanceStatus = 'accepted';
  expect(action(value)).toBe('correction');
  value.actions = [upload('failed_permanent', 'old')];
  expect(action(value)).toBe('missing');
  value.assignment!.requiredDocuments =
    value.assignment!.requiredDocuments.filter(
      (document) => document.documentType === 'passport',
    );
  expect(action(value)).toBe('failed');
});
for (const status of ['queued', 'sending', 'retry_wait'] as const)
  test(`${status} replacement is background work, not another correction`, () => {
    const value = data();
    value.assignment!.requiredDocuments =
      value.assignment!.requiredDocuments.filter(
        (document) => document.documentType === 'passport',
      );
    value.assignment!.documentSubmissions = [
      {
        submissionId: 'old',
        clientActionId: 'old',
        documentType: 'passport',
        status: 'correction_requested',
        correctionReason: 'Original reason',
        serverRevision: 2,
        createdAt: 1,
      },
    ];
    value.actions = [upload(status, 'old')];
    const views = documentViews(value);
    expect(action(value)).toBe('saved');
    expect(documentPresentationFacts(views)[0]?.isSent).toBe(false);
    expect(submissionStatusKey(views[0]!.current)).toBe(
      status === 'sending'
        ? 'ui.sending'
        : status === 'retry_wait'
          ? 'ui.retry'
          : 'ui.saved',
    );
    expect(views[0]!.history[0]?.correctionReason).toBe('Original reason');
  });
test('delivery evidence counts as sent but only staff approval completes work', () => {
  const value = data();
  value.assignment!.requiredDocuments =
    value.assignment!.requiredDocuments.filter(
      (document) => document.documentType === 'passport',
    );
  value.assignment!.documentSubmissions = [
    {
      submissionId: 'server',
      clientActionId: 'new-action',
      documentType: 'passport',
      status: 'pending_review',
      correctionReason: null,
      serverRevision: 1,
      createdAt: 1,
    },
  ];
  expect(action(value)).toBe('review');
  expect(documentPresentationFacts(documentViews(value))[0]?.isSent).toBe(true);
  value.assignment!.documentSubmissions[0]!.status = 'approved';
  expect(action(value)).toBe('complete');
  value.assignment!.documentSubmissions[0]!.status = 'correction_requested';
  expect(action(value)).toBe('correction');
  expect(documentPresentationFacts(documentViews(value))[0]?.isSent).toBe(true);
  value.actions = [upload('failed_permanent')];
  expect(documentPresentationFacts(documentViews(value))[0]?.isSent).toBe(
    false,
  );
  expect(submissionStatusKey(documentViews(value)[0]!.current)).toBe(
    'documents.status.correction_requested',
  );
});
test('uncertain, unavailable and absent cache never imply completion', () => {
  const value = data();
  value.assignment!.requiredDocuments = [];
  value.refreshNeeded = true;
  expect(action(value)).toBe('refresh');
  expect(nextWorkerAction(value, [], false)).toBe('unavailable');
  value.assignment = null;
  expect(action(value)).toBe('refresh');
});

test('disabled capture does not advertise unsupported worker actions', () => {
  const value = data();
  expect(
    nextWorkerAction(
      value,
      documentPresentationFacts(documentViews(value)),
      true,
      false,
    ),
  ).toBe('unavailable');
});
