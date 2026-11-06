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
  authorize,
  createAuthApp,
  errors,
  hash,
  object,
  string,
} from './app.ts';
import { Failures } from './failure-injection.ts';
import { documentCatalog } from './seed.ts';

const actionId = (value: unknown): string => {
  const id = string(value);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new ApiError(422, 'invalid_action_id');
  return id;
};
function replay(
  store: Store,
  workerId: string,
  id: string,
  fingerprint: string,
  res: Response,
): boolean {
  const receipt = store.receipt(workerId, id);
  if (!receipt) return false;
  if (receipt.fingerprint !== fingerprint)
    throw new ApiError(409, 'action_id_conflict');
  res.status(200).json(JSON.parse(receipt.responseJson) as unknown);
  return true;
}
function receipt(
  store: Store,
  workerId: string,
  id: string,
  fingerprint: string,
  response: unknown,
): void {
  store.db
    .prepare('INSERT INTO receipts VALUES(?,?,?,?)')
    .run(workerId, id, fingerprint, JSON.stringify(response));
}
function reply(res: Response, response: unknown, failures: Failures): void {
  if (failures.takeDrop()) {
    res.socket?.destroy();
    return;
  }
  res.status(201).json(response);
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
function validImage(file: Express.Multer.File): boolean {
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
  const app = createAuthApp(store, async (req, _res, next) => {
    authorize(store, req);
    await failures.beforeRequest();
    next();
  });
  const authenticate = (req: Request, _res: Response, next: () => void) => {
    authorize(store, req);
    next();
  };
  app.post('/me/terms-acceptances', authenticate, async (req, res) => {
    const workerId = authorize(store, req);
    const body = object(req.body as unknown);
    const id = actionId(body.clientActionId);
    const version = string(body.termsVersionId);
    const fingerprint = hash(JSON.stringify(['terms', workerId, version]));
    if (replay(store, workerId, id, fingerprint, res)) return;
    await failures.beforeRequest();
    if (replay(store, workerId, id, fingerprint, res)) return;
    const response = store.transaction(() => {
      if (version !== store.settings().termsVersion)
        throw new ApiError(409, 'stale_terms', {
          currentTermsVersionId: store.settings().termsVersion,
        });
      const response = {
        acceptanceId: randomUUID(),
        clientActionId: id,
        termsVersionId: version,
        serverRevision: store.revision(),
      };
      store.db
        .prepare('INSERT INTO acceptances VALUES(?,?,?,?)')
        .run(response.acceptanceId, workerId, id, version);
      receipt(store, workerId, id, fingerprint, response);
      return response;
    });
    reply(res, response, failures);
  });
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
  app.post('/me/documents', authenticate, upload, async (req, res) => {
    const workerId = authorize(store, req);
    const body = object(req.body as unknown);
    const id = actionId(body.clientActionId);
    const documentType = string(body.documentType);
    const file = req.file;
    if (!file) throw new ApiError(422, 'image_required');
    const replaces =
      body.replacesSubmissionId === undefined
        ? null
        : string(body.replacesSubmissionId);
    const fingerprint = hash(
      JSON.stringify([
        'document',
        workerId,
        documentType,
        replaces,
        hash(file.buffer),
      ]),
    );
    if (replay(store, workerId, id, fingerprint, res)) return;
    await failures.beforeRequest();
    // Another request may have committed while latency yielded. M3 requires replay, not a second effect.
    if (replay(store, workerId, id, fingerprint, res)) return;
    if (failures.force413 || file.size >= 1_500_000)
      throw new ApiError(413, 'upload_too_large');
    if (!documentCatalog.some((d) => d.documentType === documentType))
      throw new ApiError(422, 'unknown_document_type');
    if (!validImage(file)) throw new ApiError(422, 'invalid_image');
    if (
      replaces &&
      !store
        .submissions(workerId)
        .some(
          (s) => s.submissionId === replaces && s.documentType === documentType,
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
          clientActionId: id,
          documentType,
          status: 'pending_review',
          correctionReason: null,
          serverRevision: store.revision(),
        };
        store.db
          .prepare('INSERT INTO submissions VALUES(?,?,?,?,?,?,?,?,?,?)')
          .run(
            submissionId,
            workerId,
            id,
            documentType,
            'pending_review',
            null,
            response.serverRevision,
            fileName,
            Date.now(),
            replaces,
          );
        receipt(store, workerId, id, fingerprint, response);
        return response;
      });
    } catch (error) {
      unlinkSync(join(store.uploads, fileName));
      throw error;
    }
    reply(res, response, failures);
  });
  // Development controls are absent by default and always absent in production.
  if (options.controlsEnabled && process.env.NODE_ENV !== 'production') {
    app.use('/__dev', (req, _res, next) => {
      if (
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
          req.socket.remoteAddress ?? '',
        )
      )
        throw new ApiError(403, 'local_control_only');
      next();
    });
    app.post('/__dev/failures', (req, res) => {
      failures.configure(req.body as unknown);
      res.json({ status: 'configured' });
    });
    app.post('/__dev/terms', (req, res) => {
      if (object(req.body as unknown).version !== 'v3')
        throw new ApiError(422, 'invalid_terms_version');
      store.transaction(() => {
        store.db
          .prepare("UPDATE settings SET termsVersion='v3' WHERE id=1")
          .run();
        store.revision();
      });
      res.json({ termsVersionId: 'v3' });
    });
    app.post('/__dev/expire-sessions', (_req, res) => {
      store.db.prepare('UPDATE sessions SET expiresAt=0').run();
      res.json({ status: 'expired' });
    });
    app.post('/__dev/review', (req, res) => {
      const body = object(req.body as unknown);
      const id = string(body.submissionId);
      const status = body.status;
      if (status !== 'approved' && status !== 'correction_requested')
        throw new ApiError(422, 'invalid_review_status');
      const reason =
        status === 'correction_requested'
          ? string(body.correctionReason)
          : null;
      const response = store.transaction(() => {
        const revision = store.revision();
        const result = store.db
          .prepare(
            'UPDATE submissions SET status=?,correctionReason=?,serverRevision=? WHERE submissionId=?',
          )
          .run(status, reason, revision, id);
        if (!result.changes) throw new ApiError(404, 'submission_not_found');
        return {
          submissionId: id,
          status,
          correctionReason: reason,
          serverRevision: revision,
        };
      });
      res.json(response);
    });
    app.get('/__dev/state', (_req, res) => {
      res.json({
        terms: store.settings(),
        receipts: store.db
          .prepare(
            'SELECT workerId,clientActionId FROM receipts ORDER BY workerId,clientActionId',
          )
          .all(),
        acceptances: store.db.prepare('SELECT * FROM acceptances').all(),
        documentSubmissions: store.db
          .prepare(
            'SELECT submissionId,workerId,clientActionId,documentType,status,correctionReason,serverRevision FROM submissions',
          )
          .all(),
      });
    });
  }
  app.use((_req, res) => {
    res.status(404).json({ code: 'not_found' });
  });
  app.use(
    (
      error: unknown,
      req: Request,
      res: Response,
      next: (error?: unknown) => void,
    ) => {
      if (error instanceof multer.MulterError) {
        res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 422).json({
          code:
            error.code === 'LIMIT_FILE_SIZE'
              ? 'upload_too_large'
              : 'invalid_upload',
        });
        return;
      }
      errors(error, req, res, next);
    },
  );
  return { app, store, failures };
}
