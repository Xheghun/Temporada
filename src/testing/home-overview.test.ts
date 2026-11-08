import { homeOverview } from '../features/assignment/domain/home-overview';
import {
  documentViews,
  documentPresentationFacts,
} from '../features/documents/domain/document-view';
import type {
  DeliveryStatus,
  OutboxAction,
  WorkerViewData,
} from '../core/offline/domain/types';
import { assignmentFixture } from './persistence-fixtures';

export function overviewData(workerId = 'ana'): WorkerViewData {
  return {
    assignment: assignmentFixture(workerId),
    actions: [],
    cachedAt: 1,
    refreshNeeded: false,
    refreshError: null,
  };
}
export function termsAction(
  status: DeliveryStatus,
  version = 'v2',
): OutboxAction {
  return {
    id: `terms-${status}`,
    clientActionId: `terms-${status}`,
    workerId: 'ana',
    actionType: 'terms_acceptance',
    payload: {
      kind: 'terms_acceptance',
      workerId: 'ana',
      clientActionId: `terms-${status}`,
      termsVersionId: version,
    },
    sequence: 1,
    fileUri: null,
    status,
    attemptCount: 1,
    nextAttemptAt: 0,
    lastErrorCode: null,
    createdAt: 1,
    updatedAt: 1,
  };
}
function project(data: WorkerViewData) {
  return homeOverview(data, documentPresentationFacts(documentViews(data)));
}
test('unknown differs from loaded zero, including a loaded view without assignment', () => {
  expect(homeOverview(null, null).pendingCount).toBeNull();
  const data = overviewData();
  expect(project(data).pendingCount).toBe(0);
  data.assignment = null;
  expect(project(data)).toMatchObject({
    pendingCount: 0,
    termsStatus: null,
    documents: null,
  });
});
test('only active actions count and permanent/stale attention remains separate', () => {
  const data = overviewData();
  data.actions = [
    'queued',
    'sending',
    'retry_wait',
    'delivered',
    'superseded',
    'failed_permanent',
    'stale',
  ].map((status) => termsAction(status as DeliveryStatus));
  expect(project(data)).toMatchObject({
    pendingCount: 3,
    attentionCount: 2,
    termsStatus: 'update_required',
  });
});
test.each(['queued', 'sending', 'retry_wait', 'failed_permanent'] as const)(
  'current terms preserve %s delivery state',
  (status) => {
    const data = overviewData();
    data.actions = [termsAction(status)];
    expect(project(data)).toMatchObject({
      termsStatus: status === 'failed_permanent' ? 'failed' : 'pending_sync',
      termsDelivery: status,
    });
  },
);
test('an old accepted or stale version never confirms current v3', () => {
  const data = overviewData();
  data.assignment!.terms.termsVersionId = 'v3';
  data.actions = [termsAction('delivered')];
  expect(project(data).termsStatus).toBe('unconfirmed');
  data.actions = [termsAction('stale')];
  expect(project(data)).toMatchObject({
    termsStatus: 'unconfirmed',
    needsReconfirmation: true,
  });
  data.assignment!.terms.serverAcceptanceStatus = 'accepted';
  expect(project(data).termsStatus).toBe('accepted');
});
test('known review survives an unresolved original receipt while delivery stays pending', () => {
  const data = overviewData('carla');
  const submission = data.assignment!.documentSubmissions[0]!;
  submission.status = 'approved';
  data.actions = [
    {
      ...termsAction('retry_wait'),
      id: submission.clientActionId,
      clientActionId: submission.clientActionId,
      workerId: 'carla',
      actionType: 'document_upload',
      payload: {
        kind: 'document_upload',
        workerId: 'carla',
        clientActionId: submission.clientActionId,
        documentType: 'passport',
        replacesSubmissionId: null,
        sha256: 'digest',
        localSubmissionId: 'local-submission',
      },
      fileUri: 'file:///private/passport.jpg',
    },
  ];
  expect(project(data).documents).toMatchObject({
    total: 3,
    delivered: 0,
    pending: 1,
    approved: 1,
    corrections: 0,
  });
  data.actions[0]!.status = 'delivered';
  expect(project(data).documents).toMatchObject({
    delivered: 1,
    pending: 0,
    approved: 1,
  });
});
test.each(['queued', 'failed_permanent'] as const)(
  'a %s replacement keeps an old correction historical',
  (status) => {
    const data = overviewData('carla');
    data.actions = [
      {
        ...termsAction(status),
        workerId: 'carla',
        actionType: 'document_upload',
        payload: {
          kind: 'document_upload',
          workerId: 'carla',
          clientActionId: 'replacement',
          documentType: 'passport',
          replacesSubmissionId: 'seed-carla-passport',
          sha256: 'digest',
          localSubmissionId: 'local-submission',
        },
        fileUri: 'file:///private/replacement.jpg',
      },
    ];
    expect(project(data).documents).toMatchObject({
      delivered: 0,
      corrections: 0,
      pending: status === 'queued' ? 1 : 0,
      failed: status === 'failed_permanent' ? 1 : 0,
    });
  },
);
test('missing/disabled facts are unavailable; an empty known catalog has zero required documents', () => {
  const data = overviewData();
  expect(homeOverview(data, null).documents).toBeNull();
  data.assignment!.requiredDocuments = [];
  expect(project(data).documents).toMatchObject({
    total: 0,
    delivered: 0,
    approved: 0,
  });
});

test.each(['pending_review', 'approved', 'correction_requested'] as const)(
  'staff %s counts come from the current submission without inferring review from delivery',
  (status) => {
    const data = overviewData('carla');
    data.assignment!.documentSubmissions[0]!.status = status;
    expect(project(data).documents).toMatchObject({
      delivered: 1,
      approved: status === 'approved' ? 1 : 0,
      awaitingReview: status === 'pending_review' ? 1 : 0,
      corrections: status === 'correction_requested' ? 1 : 0,
    });
  },
);
test('refresh-required saved facts carry update context; unknown submission evidence is unavailable', () => {
  const data = overviewData();
  data.refreshNeeded = true;
  expect(project(data).documents?.isUpdating).toBe(true);
  const facts = documentPresentationFacts(documentViews(data));
  facts[0]!.needsRefresh = true;
  expect(homeOverview(data, facts).documents).toBeNull();
});
