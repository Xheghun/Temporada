import type { SyncEngine } from './sync-engine.ts';
export interface SyncSignals {
  foreground(callback: () => void): () => void;
  connectivity(callback: () => void): () => void;
  session(callback: () => void): () => void;
  enqueue(callback: () => void): () => void;
}
/** Wire one runtime instance; UI/auth services provide signals without issuing raw requests. */
export function attachSyncTriggers(
  engine: SyncEngine,
  signals: SyncSignals,
): () => void {
  const request = () => {
    void engine.request();
  };
  const unsubscribe = [
    signals.foreground(request),
    signals.connectivity(request),
    signals.session(request),
    signals.enqueue(request),
  ];
  void engine.start();
  return () => {
    unsubscribe.forEach((stop) => stop());
    engine.stop();
  };
}
