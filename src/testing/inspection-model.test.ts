import { readInspectionModel } from './inspection-model';
import type { InspectionDependencies } from './inspection-model';
import type {
  OutboxAction,
  WorkerViewData,
  LocalSubmission,
} from '../core/offline/domain/types';

function action(workerId = 'ana'): OutboxAction {
  return {
    sequence: 1,
    id: 'local-action',
    clientActionId: 'client-action',
    workerId,
    actionType: 'document_upload',
    payload: {
      kind: 'document_upload',
      clientActionId: 'client-action',
      workerId,
      documentType: 'passport',
      localSubmissionId: 'local-submission',
      sha256: 'expected-digest',
      replacesSubmissionId: null,
    },
    fileUri: 'file:///fictional/private/image.jpg',
    status: 'queued',
    attemptCount: 2,
    nextAttemptAt: 1000,
    lastErrorCode: 'http_500',
    createdAt: 1,
    updatedAt: 2,
  };
}
function view(actions: OutboxAction[] = [action()]): WorkerViewData & {
  submissions: LocalSubmission[];
} {
  return {
    assignment: null,
    actions,
    cachedAt: 1,
    refreshNeeded: false,
    refreshError: null,
    submissions: [],
  };
}
function dependencies(
  readView: InspectionDependencies['readView'],
): InspectionDependencies {
  return {
    readView,
    now: () => 200,
    inspectFile: jest.fn(async () => ({
      exists: true,
      ownsPrivateFile: true,
      bytes: 1200,
      digest: 'expected-digest',
      digestMatches: true,
    })),
    countFiles: async () => ({
      managedFiles: 1,
      journals: 0,
      quarantinedJournals: 0,
      pickerCacheFiles: 0,
    }),
  };
}

test('inspection preserves durable identities and backoff while excluding private input fields', async () => {
  const privateAction = {
    ...action(),
    token: 'fictional-not-for-artifacts',
    imageBytes: [1, 2, 3],
  };
  const report = await readInspectionModel(
    'ana',
    dependencies(async () => view([privateAction])),
  );
  expect(report.actions[0]).toMatchObject({
    actionId: 'local-action',
    clientActionId: 'client-action',
    submissionId: 'local-submission',
    status: 'queued',
    attemptCount: 2,
    nextAttemptAt: 1000,
    bytes: 1200,
    digestMatches: true,
  });
  const serialized = JSON.stringify(report);
  expect(serialized).not.toContain('file:///');
  expect(serialized).not.toContain('fictional-not-for-artifacts');
  expect(serialized).not.toContain('imageBytes');
});

test('a concurrent delivery retries the sample instead of mixing metadata and file evidence', async () => {
  const queued = view();
  const delivered = view([{ ...action(), status: 'delivered', updatedAt: 3 }]);
  const samples = [queued, delivered, delivered, delivered];
  const readView = jest.fn(async () => samples.shift() ?? delivered);
  const report = await readInspectionModel('ana', dependencies(readView));
  expect(report.actions[0]?.status).toBe('delivered');
  expect(readView).toHaveBeenCalledTimes(4);
});

test('foreign-worker actions fail before any file is opened', async () => {
  const inspectionDependencies = dependencies(async () =>
    view([action('bruno')]),
  );
  await expect(
    readInspectionModel('ana', inspectionDependencies),
  ).rejects.toThrow('inspection_worker_mismatch');
  expect(inspectionDependencies.inspectFile).not.toHaveBeenCalled();
});

test('an unstable snapshot fails after bounded attempts', async () => {
  let revision = 0;
  const readView = jest.fn(async () => ({ ...view(), cachedAt: revision++ }));
  await expect(
    readInspectionModel('ana', dependencies(readView)),
  ).rejects.toThrow('inspection_snapshot_changed');
  expect(readView).toHaveBeenCalledTimes(6);
});

test('server review identity, revision and reason are retained verbatim', async () => {
  const snapshot: ReturnType<typeof view> = {
    ...view(),
    submissions: [
      {
        submissionId: 'local-submission',
        serverSubmissionId: 'server-submission',
        clientActionId: 'client-action',
        documentType: 'passport',
        serverStatus: 'correction_requested',
        correctionReason: 'Foto borrosa, vuelva a tomarla',
        serverRevision: 7,
        serverCreatedAt: 1,
        createdAt: 1,
        replacesSubmissionId: null,
        deliveryStatus: 'queued',
      },
    ],
    assignment: {
      worker: { workerId: 'ana', displayName: 'Ana López' },
      assignment: {
        orderId: 'order',
        employer: 'Fictional farm',
        worksite: 'Fictional site',
        seasonStart: '2026-03-01',
        seasonEnd: '2026-07-31',
      },
      terms: {
        termsVersionId: 'v2',
        serverAcceptanceStatus: 'not_confirmed',
        summary: { es: 'Condiciones', en: 'Terms' },
      },
      requiredDocuments: [],
      serverRevision: 7,
      documentSubmissions: [
        {
          submissionId: 'server-submission',
          clientActionId: 'client-action',
          documentType: 'passport',
          status: 'correction_requested',
          correctionReason: 'Foto borrosa, vuelva a tomarla',
          serverRevision: 7,
          createdAt: 1,
        },
      ],
    },
  };
  const report = await readInspectionModel(
    'ana',
    dependencies(async () => snapshot),
  );
  expect(report.actions[0]?.serverSubmissionId).toBe('server-submission');
  expect(report.submissions[0]).toMatchObject({
    submissionId: 'local-submission',
    serverSubmissionId: 'server-submission',
    status: 'correction_requested',
    serverRevision: 7,
    correctionReason: 'Foto borrosa, vuelva a tomarla',
  });
  const submission = snapshot.submissions[0]!;
  submission.serverRevision = null;
  submission.serverStatus = 'pending_review';
  submission.correctionReason = null;
  snapshot.assignment!.documentSubmissions = [];
  const revisionless = await readInspectionModel(
    'ana',
    dependencies(async () => snapshot),
  );
  expect(revisionless.actions[0]?.serverSubmissionId).toBe('server-submission');
  expect(revisionless.submissions[0]).toMatchObject({
    serverSubmissionId: 'server-submission',
    serverRevision: null,
    status: 'pending_review',
  });
});
