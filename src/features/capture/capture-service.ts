import type { DurableUpload } from '../../core/offline/domain/types.ts';
import type { SyncSession, SessionProvider } from '../../core/sync/types.ts';
import { CaptureError } from '../../core/files/upload-file-store.ts';
import type {
  UploadFileStore,
  SelectedImage,
} from '../../core/files/upload-file-store.ts';
export interface CaptureSelection {
  workerId: string;
  generation: number;
  documentType: string;
  expectedSubmissionId: string | null;
}
export interface CaptureState {
  selection: CaptureSelection | null;
  preview: DurableUpload | null;
  phase: 'idle' | 'choosing' | 'preparing' | 'saving' | 'saved';
  error: string | null;
  savedActionId: string | null;
}
export interface CaptureDependencies {
  enabled(): boolean;
  validate(selection: CaptureSelection): boolean;
  session: SessionProvider & {
    subscribeSession(listener: () => void): () => void;
  };
  files: UploadFileStore;
  choose(source: 'camera' | 'gallery'): Promise<SelectedImage | null>;
  submit(
    selection: CaptureSelection,
    file: DurableUpload,
  ): Promise<string | null>;
  reportCleanupFailure(): void;
}
export class CaptureService {
  private state: CaptureState = {
    selection: null,
    preview: null,
    phase: 'idle',
    error: null,
    savedActionId: null,
  };
  private readonly listeners = new Set<() => void>();
  private operation = 0;
  private readonly unsubscribe: () => void;
  private readonly dependencies: CaptureDependencies;
  constructor(dependencies: CaptureDependencies) {
    this.dependencies = dependencies;
    this.unsubscribe = dependencies.session.subscribeSession(() =>
      this.close(),
    );
  }
  isEnabled = () => this.dependencies.enabled();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<CaptureState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private current(
    selection: CaptureSelection,
    session: SyncSession,
    operation: number,
  ) {
    const current = this.dependencies.session.current();
    return (
      this.operation === operation &&
      current?.workerId === selection.workerId &&
      current.generation === selection.generation &&
      current.token === session.token
    );
  }
  open(selection: CaptureSelection) {
    this.close();
    const session = this.dependencies.session.current();
    if (
      !this.isEnabled() ||
      session?.workerId !== selection.workerId ||
      session.generation !== selection.generation ||
      !this.dependencies.validate(selection)
    ) {
      this.update({ error: 'capture_selection_changed' });
      return;
    }
    this.update({ selection });
  }
  close = () => {
    this.operation++;
    const preview = this.state.preview;
    this.update({
      selection: null,
      preview: null,
      phase: 'idle',
      error: null,
      savedActionId: null,
    });
    if (preview)
      void this.dependencies.files
        .discard(preview)
        .catch(() => this.dependencies.reportCleanupFailure());
  };
  async choose(source: 'camera' | 'gallery'): Promise<void> {
    const selection = this.state.selection,
      session = this.dependencies.session.current();
    if (
      !selection ||
      !session ||
      !this.isEnabled() ||
      !['idle'].includes(this.state.phase)
    )
      return;
    const operation = ++this.operation;
    this.update({ phase: 'choosing', error: null });
    let selected: SelectedImage | null = null;
    try {
      const image = await this.dependencies.choose(source);
      selected = image;
      if (!this.current(selection, session, operation)) return;
      if (!image) return;
      this.update({ phase: 'preparing' });
      const preview = await this.dependencies.files.prepare(
        selection.workerId,
        image,
      );
      if (!this.current(selection, session, operation)) {
        await this.dependencies.files.discard(preview);
        return;
      }
      const previous = this.state.preview;
      this.update({ preview });
      if (previous) await this.dependencies.files.discard(previous);
    } catch (error) {
      if (this.current(selection, session, operation))
        this.update({
          error:
            error instanceof CaptureError
              ? error.code
              : 'capture_compression_failed',
        });
    } finally {
      if (selected)
        try {
          await this.dependencies.files.discardSelection(selected);
        } catch {
          this.dependencies.reportCleanupFailure();
        }
      if (this.current(selection, session, operation))
        this.update({ phase: 'idle' });
    }
  }
  async save(): Promise<void> {
    const selection = this.state.selection,
      preview = this.state.preview,
      session = this.dependencies.session.current();
    if (
      !selection ||
      !preview ||
      !session ||
      !this.isEnabled() ||
      this.state.phase !== 'idle'
    )
      return;
    const operation = ++this.operation;
    if (!this.current(selection, session, operation)) return;
    this.update({ phase: 'saving', error: null });
    try {
      const actionId = await this.dependencies.files.commit(preview, () =>
        this.dependencies.submit(selection, preview),
      );
      if (this.current(selection, session, operation))
        this.update({ preview: null, phase: 'saved', savedActionId: actionId });
    } catch (error) {
      if (this.current(selection, session, operation))
        this.update({
          preview: null,
          phase: 'idle',
          error:
            error instanceof CaptureError ? error.code : 'capture_save_failed',
        });
    }
  }
  settingsFailed() {
    this.update({ error: 'capture_settings_failed' });
  }
  dispose() {
    this.close();
    this.unsubscribe();
    this.listeners.clear();
  }
}
