import type { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  openSync,
  writeFileSync,
  fsyncSync,
  unlinkSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { Store } from './storage.ts';
import {
  ApiError,
  authorizeWorkerRequest,
  createAuthApp,
  handleApiError,
  sha256,
  parseRequestObject,
  parseNonEmptyString,
} from './app.ts';
import { Failures } from './failure-injection.ts';
import { documentCatalog } from './seed.ts';

const parseClientActionId = (value: unknown): string => {
  const clientActionId = parseNonEmptyString(value);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clientActionId,
    )
  )
    throw new ApiError(422, 'invalid_action_id');
  return clientActionId;
};
function sendReplayReceipt(
  store: Store,
  workerId: string,
  clientActionId: string,
  fingerprint: string,
  httpResponse: Response,
): boolean {
  const persistReceipt = store.receipt(workerId, clientActionId);
  if (!persistReceipt) return false;
  if (persistReceipt.fingerprint !== fingerprint)
    throw new ApiError(409, 'action_id_conflict');
  httpResponse
    .status(200)
    .json(JSON.parse(persistReceipt.responseJson) as unknown);
  return true;
}
function persistReceipt(
  store: Store,
  workerId: string,
  clientActionId: string,
  fingerprint: string,
  response: unknown,
): void {
  store.database
    .prepare('INSERT INTO receipts VALUES(?,?,?,?)')
    .run(workerId, clientActionId, fingerprint, JSON.stringify(response));
}
function sendCreatedResponse(
  httpResponse: Response,
  response: unknown,
  failures: Failures,
): void {
  if (failures.takeDrop()) {
    httpResponse.socket?.destroy();
    return;
  }
  httpResponse.status(201).json(response);
}
function persistFile(directory: string, name: string, buffer: Buffer): void {
  const file = join(directory, name);
  let created = false;
  try {
    const descriptor = openSync(file, 'wx', 0o600);
    created = true;
    try {
      writeFileSync(descriptor, buffer);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    const parent = openSync(directory, 'r');
    try {
      fsyncSync(parent);
    } finally {
      closeSync(parent);
    }
  } catch (error) {
    if (created && existsSync(file)) unlinkSync(file);
    throw error;
  }
}
function isSupportedImage(file: Express.Multer.File): boolean {
  return (
    (file.mimetype === 'image/jpeg' &&
      file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
    (file.mimetype === 'image/png' &&
      file.buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (file.mimetype === 'image/webp' &&
      file.buffer.subarray(0, 4).toString() === 'RIFF' &&
      file.buffer.subarray(8, 12).toString() === 'WEBP')
  );
}

export function createMockService(
  directory: string,
  options: { controlsEnabled?: boolean } = {},
) {
  const store = new Store(directory);
  const failures = new Failures();
  const app = createAuthApp(store, async (request, _httpResponse, next) => {
    authorizeWorkerRequest(store, request);
    await failures.beforeRequest();
    next();
  });
  const authenticate = (
    request: Request,
    _httpResponse: Response,
    next: () => void,
  ) => {
    authorizeWorkerRequest(store, request);
    next();
  };
  app.post(
    '/me/terms-acceptances',
    authenticate,
    async (request, httpResponse) => {
      const workerId = authorizeWorkerRequest(store, request);
      const body = parseRequestObject(request.body as unknown);
      const clientActionId = parseClientActionId(body.clientActionId);
      const version = parseNonEmptyString(body.termsVersionId);
      const fingerprint = sha256(JSON.stringify(['terms', workerId, version]));
      if (
        sendReplayReceipt(
          store,
          workerId,
          clientActionId,
          fingerprint,
          httpResponse,
        )
      )
        return;
      await failures.beforeRequest();
      if (
        sendReplayReceipt(
          store,
          workerId,
          clientActionId,
          fingerprint,
          httpResponse,
        )
      )
        return;
      const response = store.transaction(() => {
        if (version !== store.settings().termsVersion)
          throw new ApiError(409, 'stale_terms', {
            currentTermsVersionId: store.settings().termsVersion,
          });
        const response = {
          acceptanceId: randomUUID(),
          clientActionId: clientActionId,
          termsVersionId: version,
          serverRevision: store.revision(),
        };
        store.database
          .prepare('INSERT INTO acceptances VALUES(?,?,?,?)')
          .run(response.acceptanceId, workerId, clientActionId, version);
        persistReceipt(store, workerId, clientActionId, fingerprint, response);
        return response;
      });
      sendCreatedResponse(httpResponse, response, failures);
    },
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 2_000_000,
      files: 1,
      fields: 4,
      fieldSize: 1024,
      parts: 5,
    },
  }).single('image');
  app.post(
    '/me/documents',
    authenticate,
    upload,
    async (request, httpResponse) => {
      const workerId = authorizeWorkerRequest(store, request);
      const body = parseRequestObject(request.body as unknown);
      const clientActionId = parseClientActionId(body.clientActionId);
      const documentType = parseNonEmptyString(body.documentType);
      const file = request.file;
      if (!file) throw new ApiError(422, 'image_required');
      const replaces =
        body.replacesSubmissionId === undefined
          ? null
          : parseNonEmptyString(body.replacesSubmissionId);
      const fingerprint = sha256(
        JSON.stringify([
          'document',
          workerId,
          documentType,
          replaces,
          sha256(file.buffer),
        ]),
      );
      if (
        sendReplayReceipt(
          store,
          workerId,
          clientActionId,
          fingerprint,
          httpResponse,
        )
      )
        return;
      await failures.beforeRequest();
      // Another request may have committed while latency yielded. M3 requires replay, not a second effect.
      if (
        sendReplayReceipt(
          store,
          workerId,
          clientActionId,
          fingerprint,
          httpResponse,
        )
      )
        return;
      if (failures.force413 || file.size >= 1_500_000)
        throw new ApiError(413, 'upload_too_large');
      if (
        !documentCatalog.some(
          (document) => document.documentType === documentType,
        )
      )
        throw new ApiError(422, 'unknown_document_type');
      if (!isSupportedImage(file)) throw new ApiError(422, 'invalid_image');
      if (
        replaces &&
        !store
          .submissions(workerId)
          .some(
            (submission) =>
              submission.submissionId === replaces &&
              submission.documentType === documentType,
          )
      )
        throw new ApiError(422, 'invalid_replacement');
      const submissionId = randomUUID();
      const fileName = `${submissionId}.image`;
      persistFile(store.uploads, fileName, file.buffer);
      let response;
      try {
        response = store.transaction(() => {
          const response = {
            submissionId,
            clientActionId: clientActionId,
            documentType,
            status: 'pending_review',
            correctionReason: null,
            serverRevision: store.revision(),
          };
          store.database
            .prepare('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?,?)')
            .run(
              submissionId,
              workerId,
              clientActionId,
              documentType,
              'pending_review',
              null,
              response.serverRevision,
              fileName,
              Date.now(),
              replaces,
            );
          persistReceipt(
            store,
            workerId,
            clientActionId,
            fingerprint,
            response,
          );
          return response;
        });
      } catch (error) {
        unlinkSync(join(store.uploads, fileName));
        throw error;
      }
      sendCreatedResponse(httpResponse, response, failures);
    },
  );
  // Development controls are absent by default and always absent in production.
  if (options.controlsEnabled && process.env.NODE_ENV !== 'production') {
    app.use('/__dev', (request, _httpResponse, next) => {
      if (
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
          request.socket.remoteAddress ?? '',
        )
      )
        throw new ApiError(403, 'local_control_only');
      next();
    });
    app.post('/__dev/failures', (request, httpResponse) => {
      failures.configure(request.body as unknown);
      httpResponse.json({ status: 'configured' });
    });
    app.post('/__dev/terms', (request, httpResponse) => {
      if (parseRequestObject(request.body as unknown).version !== 'v3')
        throw new ApiError(422, 'invalid_terms_version');
      store.transaction(() => {
        store.database
          .prepare("UPDATE settings SET termsVersion='v3' WHERE id=1")
          .run();
        store.revision();
      });
      httpResponse.json({ termsVersionId: 'v3' });
    });
    app.post('/__dev/expire-sessions', (_request, httpResponse) => {
      store.database.prepare('UPDATE sessions SET expiresAt=0').run();
      httpResponse.json({ status: 'expired' });
    });
    app.post('/__dev/review', (request, httpResponse) => {
      const body = parseRequestObject(request.body as unknown);
      const submissionId = parseNonEmptyString(body.submissionId);
      const status = body.status;
      if (status !== 'approved' && status !== 'correction_requested')
        throw new ApiError(422, 'invalid_review_status');
      const reason =
        status === 'correction_requested'
          ? parseNonEmptyString(body.correctionReason)
          : null;
      const response = store.transaction(() => {
        const revision = store.revision();
        const result = store.database
          .prepare(
            'UPDATE submissions SET status=?,correctionReason=?,serverRevision=? WHERE submissionId=?',
          )
          .run(status, reason, revision, submissionId);
        if (!result.changes) throw new ApiError(404, 'submission_not_found');
        return {
          submissionId: submissionId,
          status,
          correctionReason: reason,
          serverRevision: revision,
        };
      });
      httpResponse.json(response);
    });
    app.get('/__dev/state', (_request, httpResponse) => {
      httpResponse.json({
        terms: store.settings(),
        receipts: store.database
          .prepare(
            'SELECT workerId,clientActionId FROM receipts ORDER BY workerId,clientActionId',
          )
          .all(),
        acceptances: store.database.prepare('SELECT * FROM acceptances').all(),
        documentSubmissions: store.database
          .prepare(
            'SELECT submissionId,workerId,clientActionId,documentType,status,correctionReason,serverRevision FROM submissions',
          )
          .all(),
      });
    });
  }
  app.use((_request, httpResponse) => {
    httpResponse.status(404).json({ code: 'not_found' });
  });
  app.use(
    (
      error: unknown,
      request: Request,
      httpResponse: Response,
      next: (error?: unknown) => void,
    ) => {
      if (error instanceof multer.MulterError) {
        httpResponse.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 422).json({
          code:
            error.code === 'LIMIT_FILE_SIZE'
              ? 'upload_too_large'
              : 'invalid_upload',
        });
        return;
      }
      handleApiError(error, request, httpResponse, next);
    },
  );
  return { app, store, failures };
}
