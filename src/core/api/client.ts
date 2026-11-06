import type { OutboxAction } from '../offline/domain/types.ts';
import { TransportError } from '../sync/types.ts';
import type {
  ApiTransport,
  SyncSession,
  DeliveryResult,
} from '../sync/types.ts';
import { assignmentResponse, receiptResponse } from './contracts.ts';

export interface UploadResolver {
  resolve(action: OutboxAction): Promise<Blob>;
}
export type FetchTransport = (
  url: string,
  init: RequestInit,
) => Promise<{ status: number; json(): Promise<unknown> }>;
export function createApiTransport(
  baseUrl: string,
  files: UploadResolver,
  fetcher: FetchTransport = fetch,
  timeoutMs = 15_000,
): ApiTransport {
  if (!/^https?:\/\//.test(baseUrl)) throw new Error('api_url_required');
  const base = baseUrl.replace(/\/$/, '');
  async function request(
    session: SyncSession,
    path: string,
    body?: string | FormData,
  ): Promise<{ status: number; data: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          authorization: `Bearer ${session.token}`,
          'x-worker-id': session.workerId,
          ...(typeof body === 'string'
            ? { 'content-type': 'application/json' }
            : {}),
        },
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
      });
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        // HTTP auth/client classification remains authoritative even without a JSON error body.
        if (response.status >= 400) data = { code: 'request_rejected' };
        else throw new TransportError(0, 'invalid_api_response');
      }
      return { status: response.status, data };
    } catch (error) {
      if (error instanceof TransportError) throw error;
      throw new TransportError(0, 'network_unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }
  function errorCode(data: unknown): string {
    return typeof data === 'object' &&
      data !== null &&
      'code' in data &&
      typeof data.code === 'string'
      ? data.code
      : 'request_rejected';
  }
  return {
    async assignment(session) {
      const result = await request(session, '/me/assignment');
      if (result.status !== 200)
        throw new TransportError(result.status, errorCode(result.data));
      try {
        return assignmentResponse(result.data, session.workerId);
      } catch {
        throw new TransportError(0, 'invalid_api_response');
      }
    },
    async send(session, action): Promise<DeliveryResult> {
      if (session.workerId !== action.workerId)
        throw new TransportError(403, 'worker_forbidden');
      let path: string, body: string | FormData;
      if (action.payload.kind === 'terms_acceptance') {
        path = '/me/terms-acceptances';
        body = JSON.stringify({
          clientActionId: action.clientActionId,
          termsVersionId: action.payload.termsVersionId,
        });
      } else {
        path = '/me/documents';
        const form = new FormData();
        form.append('clientActionId', action.clientActionId);
        form.append('documentType', action.payload.documentType);
        if (action.payload.replacesSubmissionId)
          form.append(
            'replacesSubmissionId',
            action.payload.replacesSubmissionId,
          );
        const image = await files.resolve(action);
        // ExpoBlob implements Blob without inheriting RN's global Blob; preserve its multipart filename.
        Object.defineProperty(image, 'name', {
          value: 'document.image',
          configurable: true,
        });
        form.append('image', image, 'document.image');
        body = form;
      }
      const result = await request(session, path, body);
      if (result.status !== 200 && result.status !== 201)
        return { status: result.status, code: errorCode(result.data) };
      try {
        return {
          status: result.status,
          receipt: receiptResponse(result.data, action.actionType),
        };
      } catch {
        throw new TransportError(0, 'invalid_api_response');
      }
    },
  };
}
