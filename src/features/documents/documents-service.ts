import type {
  OutboxAction,
  DurableUpload,
  WorkerViewData,
} from '../../core/offline/domain/types.ts';
import type { SessionProvider, SyncSession } from '../../core/sync/types.ts';
import { documentViews } from './domain/document-view.ts';
export interface DocumentsReader {
  readView(): Promise<WorkerViewData>;
  enqueueDocument(
    documentType: string,
    file: DurableUpload,
    replacesSubmissionId?: string,
    supersedesActionId?: string,
  ): Promise<OutboxAction>;
}
export interface DocumentsDependencies {
  enabled(): boolean;
  session: SessionProvider & {
    subscribeSession(listener: () => void): () => void;
  };
  repository(workerId: string): DocumentsReader;
  online(): boolean;
  subscribeNetwork(listener: () => void): () => void;
  subscribeData(listener: (workerId: string) => void): () => void;
  notifyEnqueued(workerId: string): void;
  refresh(session: SyncSession): Promise<void>;
}
export interface DocumentsState {
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
export class DocumentsService {
  private readonly dependencies: DocumentsDependencies;
  private readonly listeners = new Set<() => void>();
  private readonly stops: (() => void)[];
  private readRevision = 0;
  private saving = false;
  private state: DocumentsState;
  constructor(dependencies: DocumentsDependencies) {
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
  private createEmptyState(): DocumentsState {
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
  getSnapshot = (): DocumentsState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<DocumentsState>) {
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
  /** The capture adapter must provide verified private durable bytes (M7); this service owns intent only. */
  async submit(
    documentType: string,
    file: DurableUpload,
    generation: number,
    expectedSubmissionId: string | null,
  ): Promise<void> {
    const session = this.dependencies.session.current();
    if (
      !this.isEnabled() ||
      !session ||
      session.generation !== generation ||
      file.workerId !== session.workerId ||
      this.saving
    )
      return;
    this.saving = true;
    this.update({ saving: true, error: null, savedActionId: null });
    try {
      const reader = this.dependencies.repository(session.workerId);
      const currentView = await reader.readView();
      if (!this.isCurrentSession(session)) return;
      const document = documentViews(currentView).find(
        (candidate) => candidate.documentType === documentType,
      );
      if (
        !document?.canSubmit ||
        (document.current?.id ?? null) !== expectedSubmissionId
      ) {
        await this.reload();
        return;
      }
      const current = document.current;
      const replacesId = current?.serverId ?? current?.replacesId ?? undefined;
      const supersedesId =
        current?.delivery === 'failed_permanent'
          ? (current.actionId ?? undefined)
          : undefined;
      const action = await reader.enqueueDocument(
        documentType,
        file,
        replacesId,
        supersedesId,
      );
      if (this.isCurrentSession(session)) {
        await this.reload();
        if (this.isCurrentSession(session))
          this.update({ savedActionId: action.id });
      }
      this.dependencies.notifyEnqueued(session.workerId);
    } catch {
      if (this.isCurrentSession(session))
        this.update({ error: 'document_save_failed' });
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
  dispose() {
    this.readRevision++;
    this.stops.forEach((stop) => stop());
    this.listeners.clear();
  }
}
