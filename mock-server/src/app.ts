import express from 'express';
import type {
  ErrorRequestHandler,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { Store } from './storage.ts';
import { assignment, documentCatalog } from './seed.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  constructor(
    status: number,
    code: string,
    details: Record<string, unknown> = {},
  ) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(422, 'invalid_request');
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new ApiError(422, 'invalid_request');
  return value;
}
export const hash = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');
export function phone(value: unknown): string {
  const normalized = string(value).replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized))
    throw new ApiError(422, 'invalid_phone');
  return normalized;
}
export function authorize(store: Store, req: Request): string {
  const bearer = req.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  const session = bearer
    ? (store.db
        .prepare('SELECT phoneNumber,expiresAt FROM sessions WHERE tokenHash=?')
        .get(hash(bearer)) as unknown as
        { phoneNumber: string; expiresAt: number } | undefined)
    : undefined;
  if (!session || session.expiresAt <= Date.now())
    throw new ApiError(401, 'session_expired');
  const workerId = req.get('x-worker-id');
  if (!workerId || store.worker(workerId)?.phoneNumber !== session.phoneNumber)
    throw new ApiError(403, 'worker_forbidden');
  return workerId;
}

export function createAuthApp(store: Store, beforeAssignment?: RequestHandler) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'seasonal-worker-mock' });
  });
  app.post('/auth/otp/request', (req, res) => {
    phone(object(req.body as unknown).phoneNumber);
    res.json({ status: 'otp_requested' });
  });
  app.post('/auth/otp/verify', (req, res) => {
    const body = object(req.body as unknown);
    const number = phone(body.phoneNumber);
    if (body.otp !== '123456') throw new ApiError(401, 'invalid_otp');
    const workers = store.phoneWorkers(number);
    if (!workers.length) throw new ApiError(401, 'unknown_phone');
    const token = randomBytes(32).toString('hex');
    store.db
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(hash(token), number, Date.now() + 24 * 60 * 60 * 1000);
    res.json({
      token,
      workers: workers.map(({ workerId, displayName }) => ({
        workerId,
        displayName,
      })),
    });
  });
  app.get(
    '/me/assignment',
    beforeAssignment ?? ((_req, _res, next) => next()),
    (req, res) => {
      const workerId = authorize(store, req);
      const current = store.settings();
      const accepted = Boolean(
        store.db
          .prepare(
            'SELECT 1 FROM acceptances WHERE workerId=? AND termsVersionId=?',
          )
          .get(workerId, current.termsVersion),
      );
      res.json({
        worker: store.worker(workerId),
        assignment,
        terms: {
          termsVersionId: current.termsVersion,
          serverAcceptanceStatus: accepted ? 'accepted' : 'not_confirmed',
          summary: {
            es: `Condiciones ${current.termsVersion} para ${assignment.orderId}: ${assignment.employer}, ${assignment.worksite}, del 1 de marzo al 31 de julio de 2026.`,
            en: `Terms ${current.termsVersion} for ${assignment.orderId}: ${assignment.employer}, ${assignment.worksite}, March 1–July 31, 2026.`,
          },
        },
        requiredDocuments: documentCatalog,
        documentSubmissions: store
          .submissions(workerId)
          .map(({ fileName: _fileName, ...submission }) => submission),
        serverRevision: current.revision,
      });
    },
  );
  return app;
}
export const errors: ErrorRequestHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ ...error.details, code: error.code });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ code: 'invalid_json' });
    return;
  }
  res.status(500).json({ code: 'internal_error' });
};
