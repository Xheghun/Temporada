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
export function parseRequestObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(422, 'invalid_request');
  return value as Record<string, unknown>;
}
export function parseNonEmptyString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new ApiError(422, 'invalid_request');
  return value;
}
export const sha256 = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');
export function normalizePhoneNumber(value: unknown): string {
  const normalized = parseNonEmptyString(value).replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized))
    throw new ApiError(422, 'invalid_phone');
  return normalized;
}
export function authorizeWorkerRequest(store: Store, request: Request): string {
  const bearer = request.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  const session = bearer
    ? (store.database
        .prepare('SELECT phoneNumber,expiresAt FROM sessions WHERE tokenHash=?')
        .get(sha256(bearer)) as unknown as
        { phoneNumber: string; expiresAt: number } | undefined)
    : undefined;
  if (!session || session.expiresAt <= Date.now())
    throw new ApiError(401, 'session_expired');
  const workerId = request.get('x-worker-id');
  if (!workerId || store.worker(workerId)?.phoneNumber !== session.phoneNumber)
    throw new ApiError(403, 'worker_forbidden');
  return workerId;
}

export function createAuthApp(store: Store, beforeAssignment?: RequestHandler) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_request, httpResponse) => {
    httpResponse.json({ status: 'ok', service: 'seasonal-worker-mock' });
  });
  app.post('/auth/otp/request', (request, httpResponse) => {
    normalizePhoneNumber(
      parseRequestObject(request.body as unknown).phoneNumber,
    );
    httpResponse.json({ status: 'otp_requested' });
  });
  app.post('/auth/otp/verify', (request, httpResponse) => {
    const body = parseRequestObject(request.body as unknown);
    const number = normalizePhoneNumber(body.phoneNumber);
    if (body.otp !== '123456') throw new ApiError(401, 'invalid_otp');
    const workers = store.phoneWorkers(number);
    if (!workers.length) throw new ApiError(401, 'unknown_phone');
    const token = randomBytes(32).toString('hex');
    store.database
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run(sha256(token), number, Date.now() + 24 * 60 * 60 * 1000);
    httpResponse.json({
      token,
      workers: workers.map(({ workerId, displayName }) => ({
        workerId,
        displayName,
      })),
    });
  });
  app.get(
    '/me/assignment',
    beforeAssignment ?? ((_request, _httpResponse, next) => next()),
    (request, httpResponse) => {
      const workerId = authorizeWorkerRequest(store, request);
      const current = store.settings();
      const accepted = Boolean(
        store.database
          .prepare(
            'SELECT 1 FROM acceptances WHERE workerId=? AND termsVersionId=?',
          )
          .get(workerId, current.termsVersion),
      );
      httpResponse.json({
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
export const handleApiError: ErrorRequestHandler = (
  error: unknown,
  _request: Request,
  httpResponse: Response,
  _next: NextFunction,
) => {
  if (error instanceof ApiError) {
    httpResponse
      .status(error.status)
      .json({ ...error.details, code: error.code });
    return;
  }
  if (error instanceof SyntaxError) {
    httpResponse.status(400).json({ code: 'invalid_json' });
    return;
  }
  httpResponse.status(500).json({ code: 'internal_error' });
};
