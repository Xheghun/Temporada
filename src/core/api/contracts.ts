import type {
  AssignmentSnapshot,
  ReviewStatus,
} from '../offline/domain/types.ts';
import type { DeliveryReceipt } from '../sync/types.ts';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_api_response');
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('invalid_api_response');
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('invalid_api_response');
  return value;
}
function localized(value: unknown): { es: string; en: string } {
  const text = object(value);
  return { es: string(text.es), en: string(text.en) };
}
function review(value: unknown): ReviewStatus {
  if (
    value !== 'pending_review' &&
    value !== 'approved' &&
    value !== 'correction_requested'
  )
    throw new Error('invalid_api_response');
  return value;
}
function reason(value: unknown): string | null {
  return value == null ? null : string(value);
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('invalid_api_response');
  return value;
}
export function assignmentResponse(
  value: unknown,
  workerId: string,
): AssignmentSnapshot {
  const root = object(value),
    worker = object(root.worker),
    assignment = object(root.assignment),
    terms = object(root.terms);
  if (
    worker.workerId !== workerId ||
    (terms.serverAcceptanceStatus !== 'accepted' &&
      terms.serverAcceptanceStatus !== 'not_confirmed')
  )
    throw new Error('invalid_api_response');
  return {
    worker: { workerId, displayName: string(worker.displayName) },
    assignment: {
      orderId: string(assignment.orderId),
      employer: string(assignment.employer),
      worksite: string(assignment.worksite),
      seasonStart: string(assignment.seasonStart),
      seasonEnd: string(assignment.seasonEnd),
    },
    terms: {
      termsVersionId: string(terms.termsVersionId),
      summary: localized(terms.summary),
      serverAcceptanceStatus: terms.serverAcceptanceStatus,
    },
    requiredDocuments: list(root.requiredDocuments).map((value) => {
      const item = object(value);
      if (typeof item.required !== 'boolean')
        throw new Error('invalid_api_response');
      return {
        documentType: string(item.documentType),
        label: localized(item.label),
        required: item.required,
      };
    }),
    documentSubmissions: list(root.documentSubmissions).map((value) => {
      const item = object(value);
      return {
        submissionId: string(item.submissionId),
        clientActionId: string(item.clientActionId),
        documentType: string(item.documentType),
        status: review(item.status),
        correctionReason: reason(item.correctionReason),
        serverRevision: integer(item.serverRevision),
        createdAt: integer(item.createdAt),
        replacesSubmissionId: reason(item.replacesSubmissionId),
      };
    }),
    serverRevision: integer(root.serverRevision),
  };
}
export function receiptResponse(
  value: unknown,
  kind: DeliveryReceipt['kind'],
): DeliveryReceipt {
  const root = object(value);
  const common = {
    clientActionId: string(root.clientActionId),
    serverRevision:
      root.serverRevision == null ? null : integer(root.serverRevision),
  };
  if (kind === 'terms_acceptance')
    return { ...common, kind, termsVersionId: string(root.termsVersionId) };
  return {
    ...common,
    kind,
    submissionId: string(root.submissionId),
    documentType: string(root.documentType),
    status: review(root.status),
    correctionReason: reason(root.correctionReason),
  };
}
