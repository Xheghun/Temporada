import type { Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { ApiError } from './app.ts';

type Operation = 'assignment' | 'terms' | 'document';
type Attempt = {
  sequence: number;
  workerId: string | null;
  clientActionId: string | null;
  operation: Operation;
  receivedAtUnixMs: number;
  elapsedMs: number;
  status: number | null;
  outcome: 'in_flight' | 'completed' | 'connection_lost';
};
type ReplayRule = {
  workerId: string;
  clientActionId: string;
  timeoutMs: number;
};
type PendingReplay = { release(): boolean; disconnect(): void };

/** Fixture-only controls. Never retain a request, header, image or response body in observations. */
export class TestControls {
  private readonly workerIds: ReadonlySet<string>;
  private readonly startedAtUnixMs = Date.now();
  private readonly startedAtMonotonicMs = performance.now();
  private sequence = 0;
  private readonly attempts: Attempt[] = [];
  private readonly requestAttempts = new WeakMap<Request, Attempt>();
  private readonly rules = new Map<string, ReplayRule>();
  private readonly pending = new Map<string, Set<PendingReplay>>();
  private readonly replayEvents: {
    workerId: string;
    clientActionId: string;
    event: string;
    elapsedMs: number;
  }[] = [];

  constructor(workerIds: ReadonlySet<string>) {
    this.workerIds = workerIds;
  }

  observe(
    request: Request,
    httpResponse: Response,
    operation: Operation,
  ): void {
    const requestedWorker = request.get('x-worker-id');
    const attempt: Attempt = {
      sequence: ++this.sequence,
      workerId:
        requestedWorker && this.workerIds.has(requestedWorker)
          ? requestedWorker
          : null,
      clientActionId: null,
      operation,
      receivedAtUnixMs: Date.now(),
      elapsedMs: performance.now() - this.startedAtMonotonicMs,
      status: null,
      outcome: 'in_flight',
    };
    this.attempts.push(attempt);
    if (this.attempts.length > 2048) this.attempts.shift();
    this.requestAttempts.set(request, attempt);
    httpResponse.once('finish', () => {
      attempt.status = httpResponse.statusCode;
      attempt.outcome = 'completed';
    });
    httpResponse.once('close', () => {
      if (attempt.outcome === 'in_flight') attempt.outcome = 'connection_lost';
    });
  }

  identify(request: Request, clientActionId: string): void {
    const attempt = this.requestAttempts.get(request);
    if (attempt) attempt.clientActionId = clientActionId;
  }

  trace() {
    return {
      startedAtUnixMs: this.startedAtUnixMs,
      startedAtMonotonicMs: this.startedAtMonotonicMs,
      totalAttempts: this.sequence,
      entries: this.attempts.map((attempt) => ({ ...attempt })),
    };
  }

  private record(rule: ReplayRule, event: string): void {
    this.replayEvents.push({
      workerId: rule.workerId,
      clientActionId: rule.clientActionId,
      event,
      elapsedMs: performance.now() - this.startedAtMonotonicMs,
    });
    if (this.replayEvents.length > 2048) this.replayEvents.shift();
  }

  replays() {
    return {
      rules: [...this.rules.values()].map((rule) => ({
        ...rule,
        pending:
          this.pending.get(`${rule.workerId}:${rule.clientActionId}`)?.size ??
          0,
      })),
      events: this.replayEvents.map((event) => ({ ...event })),
    };
  }

  configureReplay(
    workerId: string,
    clientActionId: string,
    mode: string,
    timeoutMs: number,
  ): { released: number } {
    if (!this.workerIds.has(workerId))
      throw new ApiError(422, 'invalid_fixture_worker');
    if (
      !['hold', 'release', 'disconnect'].includes(mode) ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 10 ||
      timeoutMs > 120000
    )
      throw new ApiError(422, 'invalid_replay_control');
    const key = `${workerId}:${clientActionId}`;
    if (mode === 'hold') {
      if (this.rules.size >= 32 && !this.rules.has(key))
        throw new ApiError(409, 'fixture_capacity');
      this.rules.set(key, { workerId, clientActionId, timeoutMs });
      return { released: 0 };
    }
    if (mode === 'release') this.rules.delete(key);
    let released = 0;
    for (const pending of [...(this.pending.get(key) ?? [])]) {
      if (mode === 'disconnect') pending.disconnect();
      else if (pending.release()) released++;
    }
    return { released };
  }

  deferReplay(
    workerId: string,
    clientActionId: string,
    httpResponse: Response,
    send: () => void,
  ): boolean {
    const key = `${workerId}:${clientActionId}`;
    const rule = this.rules.get(key);
    if (!rule) return false;
    const waiters = this.pending.get(key) ?? new Set<PendingReplay>();
    if (waiters.size >= 16) {
      httpResponse.status(503).json({ code: 'fixture_capacity' });
      return true;
    }
    this.pending.set(key, waiters);
    let finished = false;
    const finish = (event: string): boolean => {
      if (finished) return false;
      finished = true;
      clearTimeout(timeout);
      httpResponse.off('close', disconnected);
      waiters.delete(pending);
      if (waiters.size === 0) this.pending.delete(key);
      this.record(rule, event);
      return true;
    };
    const disconnected = () => {
      finish('client_disconnected');
    };
    const pending: PendingReplay = {
      release: () => {
        if (httpResponse.destroyed) {
          finish('client_disconnected');
          return false;
        }
        if (!finish('released')) return false;
        send();
        return true;
      },
      disconnect: () => {
        if (finish('disconnected')) httpResponse.destroy();
      },
    };
    const timeout = setTimeout(() => {
      this.rules.delete(key);
      if (finish('expired') && !httpResponse.destroyed)
        httpResponse.status(503).json({ code: 'fixture_replay_timeout' });
    }, rule.timeoutMs);
    waiters.add(pending);
    httpResponse.once('close', disconnected);
    this.record(rule, 'held');
    return true;
  }
}
