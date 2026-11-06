import type { OutboxAction } from '../offline/domain/types.ts';
import { TransportError } from './types.ts';
import type {
  SyncDependencies,
  SyncSession,
  SyncPersistence,
  ActionOutcome,
} from './types.ts';

const resolved = (action: OutboxAction) =>
  ['delivered', 'stale', 'superseded'].includes(action.status);
const resource = (action: OutboxAction) =>
  action.payload.kind === 'terms_acceptance'
    ? 'terms'
    : `document:${action.payload.documentType}`;
export function nextEligible(
  actions: OutboxAction[],
  now: number,
): OutboxAction | undefined {
  const blocked = new Set<string>();
  for (const action of actions) {
    if (resolved(action)) continue;
    const key = resource(action);
    if (blocked.has(key)) continue;
    blocked.add(key);
    if (
      ['queued', 'retry_wait'].includes(action.status) &&
      action.nextAttemptAt <= now
    )
      return action;
  }
  return undefined;
}
function nextDeadline(actions: OutboxAction[]): number | undefined {
  const blocked = new Set<string>();
  const deadlines: number[] = [];
  for (const action of actions) {
    if (resolved(action)) continue;
    const key = resource(action);
    if (blocked.has(key)) continue;
    blocked.add(key);
    if (['queued', 'retry_wait'].includes(action.status))
      deadlines.push(action.nextAttemptAt);
  }
  return deadlines.length ? Math.min(...deadlines) : undefined;
}

let processFlight: Promise<void> = Promise.resolve();

/** One runtime is expected; a process-wide guard also protects accidentally overlapping instances. No React, timer globals, native or database imports. */
export class SyncEngine {
  private readonly deps: SyncDependencies;
  private running: Promise<void> | null = null;
  private requested = false;
  private cancelWake: (() => void) | null = null;
  private stopped = false;
  private readonly recovered = new Set<string>();
  constructor(deps: SyncDependencies) {
    this.deps = deps;
  }
  private current(session: SyncSession): boolean {
    const current = this.deps.session.current();
    return (
      !this.stopped &&
      this.deps.enabled() &&
      !!current &&
      current.workerId === session.workerId &&
      current.generation === session.generation &&
      current.token === session.token
    );
  }
  request(): Promise<void> {
    if (this.stopped || !this.deps.enabled()) return Promise.resolve();
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
    const session = this.deps.session.current();
    if (session && this.deps.enabled())
      await this.deps
        .persistence(session.workerId)
        .retryNow(this.deps.clock.now());
    await this.request();
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
        const session = this.deps.session.current();
        if (!session || !this.current(session)) continue;
        const store = this.deps.persistence(session.workerId);
        // M2: interrupted-send recovery is local and must also run at offline startup.
        if (!this.recovered.has(session.workerId)) {
          await store.recoverSending();
          this.recovered.add(session.workerId);
        }
        if (!this.deps.connectivity.online()) continue;
        await this.process(session, store);
      } while (this.requested && !this.stopped);
    } catch (error) {
      this.deps.reportFailure?.(error);
      // Preserve storage on repository/integrity failures; retry only on an explicit later trigger.
      this.deps.report({
        workerId: this.deps.session.current()?.workerId ?? null,
        type: 'error',
        code: 'sync_storage_or_integrity_error',
      });
    }
  }
  private pause(session: SyncSession, status: number): void {
    this.deps.session.invalidate(
      session,
      status === 403 ? 'worker_forbidden' : 'reauthenticate',
    );
    this.deps.report({
      workerId: session.workerId,
      type: 'auth_required',
      code: status === 403 ? 'worker_forbidden' : 'session_expired',
    });
  }
  private async refresh(
    session: SyncSession,
    store: SyncPersistence,
  ): Promise<void> {
    const state = await store.refreshState();
    if (
      !state.needed ||
      state.blocked ||
      state.nextAttemptAt > this.deps.clock.now() ||
      !this.current(session)
    )
      return;
    try {
      const snapshot = await this.deps.api.assignment(session);
      // Captured worker repository may cache a late response, never a different worker/view.
      await store.cacheRefresh(snapshot);
      this.deps.report({ workerId: session.workerId, type: 'changed' });
    } catch (error) {
      if (
        error instanceof TransportError &&
        (error.status === 401 || error.status === 403)
      ) {
        if (this.current(session)) this.pause(session, error.status);
        return;
      }
      if (
        error instanceof TransportError &&
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 429].includes(error.status)
      ) {
        await store.blockRefresh(error.code);
        this.deps.report({
          workerId: session.workerId,
          type: 'error',
          code: 'refresh_requires_resolution',
        });
        return;
      }
      await store.deferRefresh(
        this.deps.clock.now() + this.deps.retryDelay(state.attemptCount + 1),
        error instanceof TransportError ? error.code : 'refresh_unavailable',
      );
      this.deps.report({
        workerId: session.workerId,
        type: 'error',
        code: 'refresh_unavailable',
      });
    }
  }
  private async process(
    session: SyncSession,
    store: SyncPersistence,
  ): Promise<void> {
    await this.refresh(session, store);
    while (this.current(session) && this.deps.connectivity.online()) {
      const action = nextEligible(
        await store.listActions(),
        this.deps.clock.now(),
      );
      if (!action) break;
      if (
        !(await store.claimAction(action.clientActionId, this.deps.clock.now()))
      )
        continue;
      if (!this.current(session)) {
        await store.finish(
          action,
          { kind: 'paused', code: 'session_changed' },
          this.deps.clock.now(),
        );
        break;
      }
      let outcome: ActionOutcome;
      try {
        const result = await this.deps.api.send(session, action);
        if ('receipt' in result)
          outcome = { kind: 'delivered', receipt: result.receipt };
        else if (result.status === 401 || result.status === 403)
          outcome = { kind: 'paused', code: result.code };
        else if (
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
              this.deps.clock.now() +
              this.deps.retryDelay(action.attemptCount + 1),
          };
        else outcome = { kind: 'failed', code: result.code };
        await store.finish(action, outcome, this.deps.clock.now());
        if (
          !('receipt' in result) &&
          (result.status === 401 || result.status === 403)
        ) {
          if (this.current(session)) this.pause(session, result.status);
          break;
        }
      } catch (error) {
        // Only transport exceptions are classified here; repository failures must escape.
        if (!(error instanceof TransportError)) throw error;
        if (error.status === 401 || error.status === 403) {
          await store.finish(
            action,
            { kind: 'paused', code: error.code },
            this.deps.clock.now(),
          );
          if (this.current(session)) this.pause(session, error.status);
          break;
        }
        outcome =
          error.status > 0 &&
          error.status < 500 &&
          ![408, 429].includes(error.status)
            ? { kind: 'failed', code: error.code }
            : {
                kind: 'retry',
                code: error.code,
                at:
                  this.deps.clock.now() +
                  this.deps.retryDelay(action.attemptCount + 1),
              };
        await store.finish(action, outcome, this.deps.clock.now());
      }
      this.deps.report({ workerId: session.workerId, type: 'changed' });
      if (this.current(session)) await this.refresh(session, store);
    }
    if (!this.current(session) || !this.deps.connectivity.online()) return;
    const refresh = await store.refreshState();
    const deadline = nextDeadline(await store.listActions());
    const times = [
      deadline,
      refresh.needed && !refresh.blocked ? refresh.nextAttemptAt : undefined,
    ].filter((v): v is number => v !== undefined);
    if (times.length)
      this.cancelWake = this.deps.clock.schedule(
        Math.max(this.deps.clock.now() + 1, Math.min(...times)),
        () => {
          void this.request();
        },
      );
  }
}
