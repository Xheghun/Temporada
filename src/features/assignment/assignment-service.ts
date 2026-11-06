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
  private readonly dependencies: AssignmentDependencies;
  private readonly listeners = new Set<() => void>();
  private readonly stops: (() => void)[];
  private readRevision = 0;
  private saving = false;
  private state: AssignmentState;
  constructor(dependencies: AssignmentDependencies) {
    this.dependencies = dependencies;
    this.state = this.createEmptyState();
    this.stops = [
      dependencies.session.subscribeSession(() => this.handleSessionChange()),
      dependencies.subscribeNetwork(() => {
        this.update({ online: dependencies.online() });
      }),
      dependencies.subscribeData((workerId) => {
        if (workerId === this.dependencies.session.current()?.workerId)
          void this.reload();
      }),
    ];
    this.handleSessionChange();
  }
  isEnabled(): boolean {
    return this.dependencies.enabled();
  }
  private createEmptyState(): AssignmentState {
    const session = this.dependencies.session.current();
    return {
      workerId: session?.workerId ?? null,
      generation: session?.generation ?? null,
      data: null,
      loading: !!session,
      saving: false,
      refreshing: false,
      online: this.dependencies.online(),
      error: null,
      savedActionId: null,
    };
  }
  private isCurrentSession(session: SyncSession): boolean {
    const currentSession = this.dependencies.session.current();
    return (
      !!currentSession &&
      currentSession.workerId === session.workerId &&
      currentSession.generation === session.generation &&
      currentSession.token === session.token
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
  private handleSessionChange() {
    this.readRevision++;
    this.saving = false;
    this.state = this.createEmptyState();
    this.listeners.forEach((notify) => notify());
    if (this.state.workerId && this.isEnabled()) void this.reload();
  }
  async reload(): Promise<void> {
    const session = this.dependencies.session.current();
    if (!session || !this.isEnabled()) return;
    const revision = ++this.readRevision;
    try {
      const data = await this.dependencies
        .repository(session.workerId)
        .readView();
      if (!this.isCurrentSession(session) || revision !== this.readRevision)
        return;
      this.update({
        data,
        loading: false,
        online: this.dependencies.online(),
        error: null,
      });
    } catch {
      if (this.isCurrentSession(session) && revision === this.readRevision)
        this.update({ loading: false, error: 'local_data_error' });
    }
  }
  async confirm(
    version: string,
    generation: number,
    replacesActionId?: string,
  ): Promise<void> {
    const session = this.dependencies.session.current();
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
      const reader = this.dependencies.repository(session.workerId),
        currentView = await reader.readView();
      if (!this.isCurrentSession(session)) return;
      // M6: the displayed version is never substituted with a newly refreshed version.
      const sameVersion =
        currentView.assignment?.terms.termsVersionId === version;
      const unresolved = currentView.actions.some(
        (action) =>
          action.payload.kind === 'terms_acceptance' &&
          action.payload.termsVersionId === version &&
          ['queued', 'sending', 'retry_wait', 'stale'].includes(action.status),
      );
      if (
        unresolved ||
        (sameVersion && !assignmentFacts(currentView).canConfirm)
      )
        return;
      // M5: only an explicit, still-current replacement may resolve a permanent failure.
      // The repository supersedes the failed predecessor and inserts new intent atomically.
      const failedId = assignmentFacts(currentView).replacementActionId;
      if ((failedId ?? undefined) !== replacesActionId) {
        await this.reload();
        return;
      }
      const action = await reader.enqueueTerms(version, replacesActionId);
      if (this.isCurrentSession(session)) {
        await this.reload();
        if (this.isCurrentSession(session))
          this.update({ savedActionId: action.id });
      }
      this.dependencies.notifyEnqueued();
    } catch {
      if (this.isCurrentSession(session)) this.update({ error: 'save_failed' });
    } finally {
      if (this.isCurrentSession(session)) {
        this.saving = false;
        this.update({ saving: false });
      }
    }
  }
  async refresh(): Promise<void> {
    const session = this.dependencies.session.current();
    if (!session || this.state.refreshing) return;
    this.update({ refreshing: true, error: null });
    try {
      await this.dependencies.refresh(session);
      if (this.isCurrentSession(session)) await this.reload();
    } catch {
      if (this.isCurrentSession(session))
        this.update({ error: 'refresh_failed' });
    } finally {
      if (this.isCurrentSession(session)) this.update({ refreshing: false });
    }
  }
  async setLanguage(language: 'es' | 'en'): Promise<void> {
    try {
      await this.dependencies.setLanguage(language);
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
