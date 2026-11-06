import type { OutboxAction } from '../core/offline/domain/types.ts';

/** The probe itself recovers sending -> queued. Reopening it must allow only that change. */
export function assertRecoverySnapshot(
  expected: OutboxAction[],
  current: OutboxAction[],
): number {
  if (expected.length !== current.length)
    throw new Error('actions_changed_after_process_restart');
  let sending = 0;
  for (let index = 0; index < expected.length; index++) {
    const old = expected[index];
    const actual = current[index];
    if (!old || !actual)
      throw new Error('actions_changed_after_process_restart');
    const recovered = old.status === 'sending' && actual.status === 'queued';
    const comparable = recovered
      ? { ...actual, status: old.status, updatedAt: old.updatedAt }
      : actual;
    if (JSON.stringify(comparable) !== JSON.stringify(old))
      throw new Error('actions_changed_after_process_restart');
    if (actual.status === 'sending') sending++;
  }
  return sending;
}
