type SessionListener = (token: string, message: string) => void;
const listeners = new Set<SessionListener>();

export function onSessionRevoked(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifySessionRevoked(token: string, message: string): void {
  listeners.forEach((listener) => listener(token, message));
}
