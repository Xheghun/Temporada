import type {
  OutboxAction,
  WorkerViewData,
} from '../../core/offline/domain/types.ts';
import type { SessionProvider, SyncSession } from '../../core/sync/types.ts';
import { assignmentFacts } from './domain/view-state.ts';
export interface AssignmentReader {
  readView(): Promise<WorkerViewData>;
  enqueueTerms(
    version: string,
    supersedesActionId?: string,
  ): Promise<OutboxAction>;
}
export interface AssignmentDependencies {
  enabled(): boolean;
  session: SessionProvider & {
    subscribeSession(listener: () => void): () => void;
  };
  repository(workerId: string): AssignmentReader;
  online(): boolean;
  subscribeNetwork(listener: () => void): () => void;
  subscribeData(listener: (workerId: string) => void): () => void;
  notifyEnqueued(): void;
  refresh(session: SyncSession): Promise<void>;
  setLanguage(language: 'es' | 'en'): Promise<void>;
}
export interface AssignmentState {
  workerId: string | null;
  generation: number | null;
  data: WorkerViewData | null;
  loading: boolean;
  saving: boolean;
  refreshing: boolean;
  online: boolean;
  error: string | null;
  savedActionId: string | null;
}
/** UI-facing application service. All async results remain bound to the captured selection. */
export class AssignmentService {
  private readonly deps: AssignmentDependencies;
  private readonly listeners = new Set<() => void>();
  private readonly stops: (() => void)[];
  private readRevision = 0;
  private saving = false;
  private state: AssignmentState;
  constructor(deps: AssignmentDependencies) {
    this.deps = deps;
    this.state = this.empty();
    this.stops = [
      deps.session.subscribeSession(() => this.select()),
      deps.subscribeNetwork(() => {
        this.update({ online: deps.online() });
      }),
      deps.subscribeData((workerId) => {
        if (workerId === this.deps.session.current()?.workerId)
          void this.reload();
      }),
    ];
    this.select();
  }
  isEnabled(): boolean {
    return this.deps.enabled();
  }
  private empty(): AssignmentState {
    const session = this.deps.session.current();
    return {
      workerId: session?.workerId ?? null,
      generation: session?.generation ?? null,
      data: null,
      loading: !!session,
      saving: false,
      refreshing: false,
      online: this.deps.online(),
      error: null,
      savedActionId: null,
    };
  }
  private current(session: SyncSession): boolean {
    const now = this.deps.session.current();
    return (
      !!now &&
      now.workerId === session.workerId &&
      now.generation === session.generation &&
      now.token === session.token
    );
  }
  getSnapshot = (): AssignmentState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<AssignmentState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((notify) => notify());
  }
  private select() {
    this.readRevision++;
    this.saving = false;
    this.state = this.empty();
    this.listeners.forEach((notify) => notify());
    if (this.state.workerId && this.isEnabled()) void this.reload();
  }
  async reload(): Promise<void> {
    const session = this.deps.session.current();
    if (!session || !this.isEnabled()) return;
    const revision = ++this.readRevision;
    try {
      const data = await this.deps.repository(session.workerId).readView();
      if (!this.current(session) || revision !== this.readRevision) return;
      this.update({
        data,
        loading: false,
        online: this.deps.online(),
        error: null,
      });
    } catch {
      if (this.current(session) && revision === this.readRevision)
        this.update({ loading: false, error: 'local_data_error' });
    }
  }
  async confirm(
    version: string,
    generation: number,
    replacesActionId?: string,
  ): Promise<void> {
    const session = this.deps.session.current();
    if (
      !this.isEnabled() ||
      !session ||
      session.generation !== generation ||
      this.saving
    )
      return;
    this.saving = true;
    this.update({ saving: true, error: null, savedActionId: null });
    try {
      const reader = this.deps.repository(session.workerId),
        before = await reader.readView();
      if (!this.current(session)) return;
      // M6: the displayed version is never substituted with a newly refreshed version.
      const sameVersion = before.assignment?.terms.termsVersionId === version;
      const unresolved = before.actions.some(
        (a) =>
          a.payload.kind === 'terms_acceptance' &&
          a.payload.termsVersionId === version &&
          ['queued', 'sending', 'retry_wait', 'stale'].includes(a.status),
      );
      if (unresolved || (sameVersion && !assignmentFacts(before).canConfirm))
        return;
      // M5: only an explicit, still-current replacement may resolve a permanent failure.
      // The repository supersedes the failed predecessor and inserts new intent atomically.
      const failedId = assignmentFacts(before).replacementActionId;
      if ((failedId ?? undefined) !== replacesActionId) {
        await this.reload();
        return;
      }
      const action = await reader.enqueueTerms(version, replacesActionId);
      if (this.current(session)) {
        await this.reload();
        if (this.current(session)) this.update({ savedActionId: action.id });
      }
      this.deps.notifyEnqueued();
    } catch {
      if (this.current(session)) this.update({ error: 'save_failed' });
    } finally {
      if (this.current(session)) {
        this.saving = false;
        this.update({ saving: false });
      }
    }
  }
  async refresh(): Promise<void> {
    const session = this.deps.session.current();
    if (!session || this.state.refreshing) return;
    this.update({ refreshing: true, error: null });
    try {
      await this.deps.refresh(session);
      if (this.current(session)) await this.reload();
    } catch {
      if (this.current(session)) this.update({ error: 'refresh_failed' });
    } finally {
      if (this.current(session)) this.update({ refreshing: false });
    }
  }
  async setLanguage(language: 'es' | 'en'): Promise<void> {
    try {
      await this.deps.setLanguage(language);
    } catch {
      this.update({ error: 'language_failed' });
    }
  }
  dispose() {
    this.readRevision++;
    this.stops.forEach((stop) => stop());
    this.listeners.clear();
  }
}
