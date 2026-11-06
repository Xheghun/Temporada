import type { OutboxAction } from '../offline/domain/types.ts';
import { TransportError } from './types.ts';
import type {
  SyncDependencies,
  SyncSession,
  SyncPersistence,
  ActionOutcome,
} from './types.ts';

const isResolvedAction = (action: OutboxAction) =>
  ['delivered', 'stale', 'superseded'].includes(action.status);
const actionResourceKey = (action: OutboxAction) =>
  action.payload.kind === 'terms_acceptance'
    ? 'terms'
    : `document:${action.payload.documentType}`;
export function nextEligible(
  actions: OutboxAction[],
  now: number,
): OutboxAction | undefined {
  const blocked = new Set<string>();
  for (const action of actions) {
    if (isResolvedAction(action)) continue;
    const resourceKey = actionResourceKey(action);
    if (blocked.has(resourceKey)) continue;
    blocked.add(resourceKey);
    if (
      ['queued', 'retry_wait'].includes(action.status) &&
      action.nextAttemptAt <= now
    )
      return action;
  }
  return undefined;
}
function nextRetryDeadline(actions: OutboxAction[]): number | undefined {
  const blocked = new Set<string>();
  const deadlines: number[] = [];
  for (const action of actions) {
    if (isResolvedAction(action)) continue;
    const resourceKey = actionResourceKey(action);
    if (blocked.has(resourceKey)) continue;
    blocked.add(resourceKey);
    if (['queued', 'retry_wait'].includes(action.status))
      deadlines.push(action.nextAttemptAt);
  }
  return deadlines.length ? Math.min(...deadlines) : undefined;
}

let processFlight: Promise<void> = Promise.resolve();

/** One runtime is expected; a process-wide guard also protects accidentally overlapping instances. No React, timer globals, native or database imports. */
export class SyncEngine {
  private readonly dependencies: SyncDependencies;
  private running: Promise<void> | null = null;
  private requested = false;
  private cancelWake: (() => void) | null = null;
  private stopped = false;
  private readonly recovered = new Set<string>();
  private readonly pendingReleases = new Map<string, Set<string>>();
  constructor(dependencies: SyncDependencies) {
    this.dependencies = dependencies;
  }
  private isCurrentSession(session: SyncSession): boolean {
    const current = this.dependencies.session.current();
    return (
      !this.stopped &&
      this.dependencies.enabled() &&
      !!current &&
      current.workerId === session.workerId &&
      current.generation === session.generation &&
      current.token === session.token
    );
  }
  request(): Promise<void> {
    if (this.stopped || !this.dependencies.enabled()) return Promise.resolve();
    this.requested = true;
    this.cancelWake?.();
    this.cancelWake = null;
    if (!this.running) {
      this.running = processFlight
        .then(() => this.drain())
        .finally(() => {
          this.running = null;
          if (this.requested && !this.stopped) void this.request();
        });
      processFlight = this.running.catch(() => undefined);
    }
    return this.running;
  }
  async start(): Promise<void> {
    await this.request();
  }
  async manualRetry(): Promise<void> {
    const session = this.dependencies.session.current();
    if (session && this.dependencies.enabled())
      await this.dependencies
        .persistence(session.workerId)
        .retryNow(this.dependencies.clock.now());
    await this.request();
  }
  settled(): Promise<void> {
    return this.running ?? Promise.resolve();
  }
  stop(): void {
    this.stopped = true;
    this.cancelWake?.();
    this.cancelWake = null;
  }
  private async drain(): Promise<void> {
    try {
      do {
        this.requested = false;
        const session = this.dependencies.session.current();
        if (!session || !this.isCurrentSession(session)) continue;
        const persistence = this.dependencies.persistence(session.workerId);
        await this.releasePendingClaims(session.workerId, persistence);
        // M2: interrupted-send recovery is local and must also run at offline startup.
        if (!this.recovered.has(session.workerId)) {
          await persistence.recoverSending();
          this.recovered.add(session.workerId);
        }
        if (!this.dependencies.connectivity.online()) continue;
        await this.process(session, persistence);
      } while (this.requested && !this.stopped);
    } catch (error) {
      this.dependencies.reportFailure?.(error);
      // Preserve storage on repository/integrity failures; retry only on an explicit later trigger.
      this.dependencies.report({
        workerId: this.dependencies.session.current()?.workerId ?? null,
        type: 'error',
        code: 'sync_storage_or_integrity_error',
      });
    }
  }
  private async releasePendingClaims(
    workerId: string,
    persistence: SyncPersistence,
  ): Promise<void> {
    const actionIds = this.pendingReleases.get(workerId);
    if (!actionIds) return;
    for (const actionId of actionIds) {
      await persistence.releaseClaim(actionId, this.dependencies.clock.now());
      actionIds.delete(actionId);
    }
    this.pendingReleases.delete(workerId);
  }
  private async recoverFailedClaim(
    persistence: SyncPersistence,
    action: OutboxAction,
    error: unknown,
  ): Promise<never> {
    let actionIds = this.pendingReleases.get(action.workerId);
    if (!actionIds) {
      actionIds = new Set();
      this.pendingReleases.set(action.workerId, actionIds);
    }
    actionIds.add(action.clientActionId);
    try {
      // The network attempt has settled under the process-wide guard. Conditional recovery
      // cannot rewind a completion that committed before an ambiguous driver error. M2/M3.
      await this.releasePendingClaims(action.workerId, persistence);
    } catch (recoveryError) {
      // Keep the targeted ID for the next trigger if storage is still unavailable.
      // Process death remains covered by durable startup sending recovery.
      throw new AggregateError(
        [error, recoveryError],
        'local_completion_and_recovery_failed',
      );
    }
    throw error;
  }
  private async finishClaim(
    persistence: SyncPersistence,
    action: OutboxAction,
    outcome: ActionOutcome,
  ): Promise<void> {
    try {
      await persistence.finish(action, outcome, this.dependencies.clock.now());
    } catch (error) {
      await this.recoverFailedClaim(persistence, action, error);
    }
  }
  private pause(session: SyncSession, status: number): void {
    this.dependencies.session.invalidate(
      session,
      status === 403 ? 'worker_forbidden' : 'reauthenticate',
    );
    this.dependencies.report({
      workerId: session.workerId,
      type: 'auth_required',
      code: status === 403 ? 'worker_forbidden' : 'session_expired',
    });
  }
  private async refresh(
    session: SyncSession,
    persistence: SyncPersistence,
  ): Promise<void> {
    const state = await persistence.refreshState();
    if (
      !state.needed ||
      state.blocked ||
      state.nextAttemptAt > this.dependencies.clock.now() ||
      !this.isCurrentSession(session)
    )
      return;
    try {
      const snapshot = await this.dependencies.api.assignment(session);
      // Captured worker repository may cache a late response, never a different worker/view.
      await persistence.cacheRefresh(snapshot);
      this.dependencies.report({ workerId: session.workerId, type: 'changed' });
    } catch (error) {
      if (
        error instanceof TransportError &&
        (error.status === 401 || error.status === 403)
      ) {
        if (this.isCurrentSession(session)) this.pause(session, error.status);
        return;
      }
      if (
        error instanceof TransportError &&
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 429].includes(error.status)
      ) {
        await persistence.blockRefresh(error.code);
        this.dependencies.report({
          workerId: session.workerId,
          type: 'error',
          code: 'refresh_requires_resolution',
        });
        return;
      }
      await persistence.deferRefresh(
        this.dependencies.clock.now() +
          this.dependencies.retryDelay(state.attemptCount + 1),
        error instanceof TransportError ? error.code : 'refresh_unavailable',
      );
      this.dependencies.report({
        workerId: session.workerId,
        type: 'error',
        code: 'refresh_unavailable',
      });
    }
  }
  private async process(
    session: SyncSession,
    persistence: SyncPersistence,
  ): Promise<void> {
    await this.refresh(session, persistence);
    while (
      this.isCurrentSession(session) &&
      this.dependencies.connectivity.online()
    ) {
      const action = nextEligible(
        await persistence.listActions(),
        this.dependencies.clock.now(),
      );
      if (!action) break;
      if (
        !(await persistence.claimAction(
          action.clientActionId,
          this.dependencies.clock.now(),
        ))
      )
        continue;
      if (!this.isCurrentSession(session)) {
        await this.finishClaim(persistence, action, {
          kind: 'paused',
          code: 'session_changed',
        });
        break;
      }
      let outcome: ActionOutcome;
      let authStatus: number | undefined;
      try {
        const result = await this.dependencies.api.send(session, action);
        if ('receipt' in result)
          outcome = { kind: 'delivered', receipt: result.receipt };
        else if (result.status === 401 || result.status === 403) {
          authStatus = result.status;
          outcome = { kind: 'paused', code: result.code };
        } else if (
          result.status === 409 &&
          result.code === 'stale_terms' &&
          action.actionType === 'terms_acceptance'
        )
          outcome = { kind: 'stale' };
        else if (
          result.status >= 500 ||
          result.status === 408 ||
          result.status === 429
        )
          outcome = {
            kind: 'retry',
            code: result.code,
            at:
              this.dependencies.clock.now() +
              this.dependencies.retryDelay(action.attemptCount + 1),
          };
        else outcome = { kind: 'failed', code: result.code };
      } catch (error) {
        if (!(error instanceof TransportError))
          return this.recoverFailedClaim(persistence, action, error);
        if (error.status === 401 || error.status === 403) {
          authStatus = error.status;
          outcome = { kind: 'paused', code: error.code };
        } else
          outcome =
            error.status > 0 &&
            error.status < 500 &&
            ![408, 429].includes(error.status)
              ? { kind: 'failed', code: error.code }
              : {
                  kind: 'retry',
                  code: error.code,
                  at:
                    this.dependencies.clock.now() +
                    this.dependencies.retryDelay(action.attemptCount + 1),
                };
      }
      // Persistence errors are not transport failures. Release the specific claim and stop
      // this pass, allowing a later explicit trigger to replay the original action safely.
      await this.finishClaim(persistence, action, outcome);
      if (authStatus !== undefined) {
        if (this.isCurrentSession(session)) this.pause(session, authStatus);
        break;
      }
      this.dependencies.report({ workerId: session.workerId, type: 'changed' });
      if (this.isCurrentSession(session))
        await this.refresh(session, persistence);
    }
    if (
      !this.isCurrentSession(session) ||
      !this.dependencies.connectivity.online()
    )
      return;
    const refresh = await persistence.refreshState();
    const deadline = nextRetryDeadline(await persistence.listActions());
    const times = [
      deadline,
      refresh.needed && !refresh.blocked ? refresh.nextAttemptAt : undefined,
    ].filter((deadline): deadline is number => deadline !== undefined);
    if (times.length)
      this.cancelWake = this.dependencies.clock.schedule(
        Math.max(this.dependencies.clock.now() + 1, Math.min(...times)),
        () => {
          void this.request();
        },
      );
  }
}
