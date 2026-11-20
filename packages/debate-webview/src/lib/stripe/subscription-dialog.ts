type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToSubscriptionDialog(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openSubscriptionDialog(): void {
  for (const listener of listeners) listener();
}
