import type { SessionProvider, SyncSession } from '../sync/types.ts';

export interface WorkerIdentity {
  workerId: string;
  displayName: string;
}
export interface StoredSession {
  token: string;
  workers: WorkerIdentity[];
  selectedWorkerId: string | null;
}
export interface SessionVault {
  read(): Promise<unknown>;
  write(session: StoredSession): Promise<void>;
  clear(): Promise<void>;
}
export interface AuthApi {
  requestOtp(phone: string): Promise<void>;
  verify(
    phone: string,
    otp: string,
  ): Promise<Omit<StoredSession, 'selectedWorkerId'>>;
}
export class AuthError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export interface AuthSnapshot {
  phase: 'booting' | 'signed_out' | 'code_sent' | 'worker_selection' | 'ready';
  workers: readonly WorkerIdentity[];
  selectedWorker: WorkerIdentity | null;
  busy: boolean;
  error: string | null;
  generation: number;
}
export function decodeSession(value: unknown): StoredSession {
  if (
    !value ||
    typeof value !== 'object' ||
    !('token' in value) ||
    typeof value.token !== 'string' ||
    !value.token.trim() ||
    !('workers' in value) ||
    !Array.isArray(value.workers) ||
    !value.workers.length ||
    !('selectedWorkerId' in value)
  )
    throw new AuthError('invalid_stored_session');
  const ids = new Set<string>();
  const workers = value.workers.map((worker: unknown) => {
    if (
      !worker ||
      typeof worker !== 'object' ||
      !('workerId' in worker) ||
      typeof worker.workerId !== 'string' ||
      !worker.workerId.trim() ||
      ids.has(worker.workerId) ||
      !('displayName' in worker) ||
      typeof worker.displayName !== 'string' ||
      !worker.displayName.trim()
    )
      throw new AuthError('invalid_stored_session');
    ids.add(worker.workerId);
    return { workerId: worker.workerId, displayName: worker.displayName };
  });
  if (
    value.selectedWorkerId !== null &&
    (typeof value.selectedWorkerId !== 'string' ||
      !ids.has(value.selectedWorkerId))
  )
    throw new AuthError('invalid_stored_session');
  return {
    token: value.token,
    workers,
    selectedWorkerId: value.selectedWorkerId,
  };
}

/** Public snapshots exclude tokens; generation changes synchronously before identity mutations. M2/M10. */
export class AuthService implements SessionProvider {
  private record: StoredSession | null = null;
  private phone: string | null = null;
  private epoch = 0;
  private snapshot: AuthSnapshot = {
    phase: 'booting',
    workers: [],
    selectedWorker: null,
    busy: true,
    error: null,
    generation: 0,
  };
  private readonly listeners = new Set<() => void>();
  private readonly sessionListeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  private readonly api: AuthApi;
  private readonly vault: SessionVault;
  constructor(api: AuthApi, vault: SessionVault) {
    this.api = api;
    this.vault = vault;
  }
  getSnapshot = (): AuthSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  subscribeSession = (listener: () => void): (() => void) => {
    this.sessionListeners.add(listener);
    return () => {
      this.sessionListeners.delete(listener);
    };
  };
  reportIssue(code: string | null): void {
    this.publish(this.snapshot.phase, this.snapshot.busy, code);
  }
  private publish(
    phase: AuthSnapshot['phase'],
    busy = false,
    error: string | null = null,
  ): void {
    const previous = this.snapshot;
    const workers = this.record?.workers ?? [];
    this.snapshot = {
      phase,
      busy,
      error,
      workers,
      generation: this.epoch,
      selectedWorker:
        phase === 'ready'
          ? (workers.find(
              (w) => w.workerId === this.record?.selectedWorkerId,
            ) ?? null)
          : null,
    };
    this.listeners.forEach((notify) => notify());
    if (
      previous.phase !== phase ||
      previous.generation !== this.epoch ||
      previous.selectedWorker?.workerId !==
        this.snapshot.selectedWorker?.workerId
    )
      this.sessionListeners.forEach((notify) => notify());
  }
  private persist(operation: () => Promise<void>): Promise<void> {
    const result = this.writes.then(operation);
    this.writes = result.catch(() => undefined);
    return result;
  }
  /** UI boundary: publish an actionable fallback without exposing raw errors or stale generations. */
  async perform(action: () => Promise<void>): Promise<void> {
    let generation = this.epoch;
    try {
      const pending = action();
      generation = this.epoch;
      await pending;
    } catch (error) {
      if (generation !== this.epoch || this.snapshot.error) return;
      this.reportIssue(error instanceof AuthError ? error.code : 'generic');
    }
  }
  settled(): Promise<void> {
    return this.writes;
  }
  current(): SyncSession | null {
    return this.snapshot.phase === 'ready' && this.record?.selectedWorkerId
      ? {
          workerId: this.record.selectedWorkerId,
          token: this.record.token,
          generation: this.epoch,
        }
      : null;
  }
  async restore(): Promise<void> {
    const epoch = ++this.epoch;
    try {
      const stored = await this.vault.read();
      if (epoch !== this.epoch) return;
      if (stored === null) {
        this.publish('signed_out');
        return;
      }
      this.record = decodeSession(stored);
      this.publish(this.record.selectedWorkerId ? 'ready' : 'worker_selection');
    } catch {
      if (epoch !== this.epoch) return;
      this.record = null;
      try {
        await this.persist(() => this.vault.clear());
      } catch {
        /* Visible fail-closed storage error below. */
      }
      if (epoch === this.epoch)
        this.publish('signed_out', false, 'secure_storage');
    }
  }
  async requestOtp(input: string): Promise<void> {
    const phone = input.replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new AuthError('invalid_phone');
    if (this.record || this.snapshot.busy)
      throw new AuthError('request_unavailable');
    const epoch = ++this.epoch;
    this.phone = null;
    this.publish('signed_out', true);
    try {
      await this.api.requestOtp(phone);
      if (epoch !== this.epoch) return;
      this.phone = phone;
      this.publish('code_sent');
    } catch (error) {
      if (epoch === this.epoch)
        this.publish(
          'signed_out',
          false,
          error instanceof AuthError ? error.code : 'network',
        );
      throw error;
    }
  }
  async verify(otp: string): Promise<void> {
    if (
      !this.phone ||
      this.snapshot.phase !== 'code_sent' ||
      this.snapshot.busy
    )
      throw new AuthError('request_unavailable');
    if (!/^\d{6}$/.test(otp)) throw new AuthError('invalid_otp');
    const phone = this.phone,
      epoch = ++this.epoch;
    this.publish('code_sent', true);
    try {
      const response = await this.api.verify(phone, otp);
      const record = decodeSession({
        ...response,
        selectedWorkerId:
          response.workers.length === 1 ? response.workers[0]?.workerId : null,
      });
      if (epoch !== this.epoch) return;
      await this.persist(async () => {
        if (epoch === this.epoch) await this.vault.write(record);
      });
      if (epoch !== this.epoch) return;
      this.record = record;
      this.phone = null;
      this.publish(record.selectedWorkerId ? 'ready' : 'worker_selection');
    } catch (error) {
      if (epoch === this.epoch)
        this.publish(
          'code_sent',
          false,
          error instanceof AuthError ? error.code : 'secure_storage',
        );
      throw error;
    }
  }
  async selectWorker(workerId: string): Promise<void> {
    if (
      !this.record ||
      !this.record.workers.some((w) => w.workerId === workerId)
    )
      throw new AuthError('worker_forbidden');
    const record = { ...this.record, selectedWorkerId: workerId },
      epoch = ++this.epoch;
    this.record = { ...this.record, selectedWorkerId: null };
    this.publish('worker_selection', true);
    try {
      await this.persist(async () => {
        if (epoch === this.epoch) await this.vault.write(record);
      });
      if (epoch !== this.epoch) return;
      this.record = record;
      this.publish('ready');
    } catch (error) {
      if (epoch === this.epoch)
        this.publish('worker_selection', false, 'secure_storage');
      throw error;
    }
  }
  async switchWorker(): Promise<void> {
    if (!this.record) return;
    const record = { ...this.record, selectedWorkerId: null },
      epoch = ++this.epoch;
    this.record = record;
    this.publish('worker_selection', true);
    try {
      await this.persist(() => this.vault.write(record));
      if (epoch === this.epoch) this.publish('worker_selection');
    } catch (error) {
      if (epoch === this.epoch)
        this.publish('worker_selection', false, 'secure_storage');
      throw error;
    }
  }
  async logout(): Promise<void> {
    const epoch = ++this.epoch;
    this.record = null;
    this.phone = null;
    this.publish('signed_out', true);
    try {
      await this.persist(() => this.vault.clear());
      if (epoch === this.epoch) this.publish('signed_out');
    } catch (error) {
      if (epoch === this.epoch)
        this.publish('signed_out', false, 'secure_storage');
      throw error;
    }
  }
  invalidate(
    session: SyncSession,
    reason: 'reauthenticate' | 'worker_forbidden',
  ): void {
    const current = this.current();
    if (
      !current ||
      current.generation !== session.generation ||
      current.workerId !== session.workerId ||
      current.token !== session.token
    )
      return;
    const epoch = ++this.epoch;
    this.record = null;
    this.phone = null;
    this.publish('signed_out', false, reason);
    void this.persist(() => this.vault.clear()).catch(() => {
      if (epoch === this.epoch)
        this.publish('signed_out', false, 'secure_storage');
    });
  }
  /** Guard late asynchronous visible results; persistence remains captured-worker scoped. */
  isCurrent(session: SyncSession): boolean {
    const current = this.current();
    return (
      !!current &&
      current.generation === session.generation &&
      current.workerId === session.workerId &&
      current.token === session.token
    );
  }
}
