import type {
  AssignmentSnapshot,
  OutboxAction,
  ReviewStatus,
} from '../offline/domain/types.ts';

export interface SyncSession {
  workerId: string;
  token: string;
  /** Changes on login, logout and selection; never a token or persisted in SQLite. */
  generation: number;
}
export interface SessionProvider {
  current(): SyncSession | null;
  /** Must invalidate only this generation and require login/selection again. */
  invalidate(
    session: SyncSession,
    reason: 'reauthenticate' | 'worker_forbidden',
  ): void;
}
export interface ConnectivityProvider {
  online(): boolean;
}
export interface SyncClock {
  now(): number;
  schedule(at: number, callback: () => void): () => void;
}
export type DeliveryReceipt =
  | {
      kind: 'terms_acceptance';
      clientActionId: string;
      termsVersionId: string;
      serverRevision: number | null;
    }
  | {
      kind: 'document_upload';
      clientActionId: string;
      submissionId: string;
      documentType: string;
      status: ReviewStatus;
      correctionReason: string | null;
      serverRevision: number | null;
    };
export type DeliveryResult =
  | { status: 200 | 201; receipt: DeliveryReceipt }
  | { status: number; code: string };
export interface ApiTransport {
  send(session: SyncSession, action: OutboxAction): Promise<DeliveryResult>;
  assignment(session: SyncSession): Promise<AssignmentSnapshot>;
}
export class TransportError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
export type ActionOutcome =
  | { kind: 'delivered'; receipt: DeliveryReceipt }
  | { kind: 'retry'; at: number; code: string }
  | { kind: 'failed'; code: string }
  | { kind: 'stale' }
  | { kind: 'paused'; code: string };
export interface RefreshState {
  blocked: boolean;
  needed: boolean;
  attemptCount: number;
  nextAttemptAt: number;
}
export interface SyncPersistence {
  listActions(): Promise<OutboxAction[]>;
  claimAction(id: string, now: number): Promise<boolean>;
  recoverSending(): Promise<number>;
  /** Release only this worker/action if it is still sending; completed states remain untouched. */
  releaseClaim(id: string, now: number): Promise<void>;
  finish(
    action: OutboxAction,
    outcome: ActionOutcome,
    now: number,
  ): Promise<void>;
  refreshState(): Promise<RefreshState>;
  cacheRefresh(snapshot: AssignmentSnapshot): Promise<void>;
  deferRefresh(at: number, code: string): Promise<void>;
  requestRefresh(): Promise<void>;
  blockRefresh(code: string): Promise<void>;
  retryNow(now: number): Promise<void>;
}
export interface SyncEvent {
  workerId: string | null;
  type: 'changed' | 'error' | 'auth_required';
  code?: string;
}
export interface SyncDependencies {
  persistence(workerId: string): SyncPersistence;
  api: ApiTransport;
  connectivity: ConnectivityProvider;
  session: SessionProvider;
  clock: SyncClock;
  retryDelay(attempt: number): number;
  enabled(): boolean;
  report(event: SyncEvent): void;
  /** Internal diagnostics sink; must redact sensitive data before external logging. */
  reportFailure?(error: unknown): void;
}
