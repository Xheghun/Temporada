import type {
  ActionPayload,
  OutboxAction,
} from '../../offline/domain/types.ts';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

function parsePersistedJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    // Never include potentially sensitive persisted content in the error.
    throw new Error('invalid_persisted_json');
  }
}

function isActionPayload(value: unknown): value is ActionPayload {
  if (
    !isRecord(value) ||
    !isUuid(value.clientActionId) ||
    !isNonEmptyString(value.workerId)
  )
    return false;
  if (value.kind === 'terms_acceptance')
    return isNonEmptyString(value.termsVersionId);
  return (
    value.kind === 'document_upload' &&
    isNonEmptyString(value.documentType) &&
    value.localSubmissionId === value.clientActionId &&
    typeof value.sha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(value.sha256) &&
    (value.replacesSubmissionId === null ||
      isNonEmptyString(value.replacesSubmissionId))
  );
}

export function decodeActionPayload(
  json: string,
  owner: Pick<OutboxAction, 'workerId' | 'clientActionId' | 'actionType'>,
): ActionPayload {
  const value = parsePersistedJson(json);
  if (!isActionPayload(value))
    throw new Error('invalid_persisted_action_payload');
  if (
    value.workerId !== owner.workerId ||
    value.clientActionId !== owner.clientActionId ||
    value.kind !== owner.actionType
  )
    throw new Error('persisted_action_identity_mismatch');
  return value;
}

export function decodeLocalizedText(json: string): { es: string; en: string } {
  const value = parsePersistedJson(json);
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.es) ||
    !isNonEmptyString(value.en)
  )
    throw new Error('invalid_persisted_localized_text');
  return { es: value.es, en: value.en };
}
