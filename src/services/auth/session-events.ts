/**
 * Barramento mínimo de eventos de sessão, desacoplando a camada HTTP (que
 * detecta a expiração) da interface (que reage navegando para a tela adequada).
 */
export type SessionEvent = 'expired';

type Listener = (event: SessionEvent) => void;

const listeners = new Set<Listener>();

export const sessionEvents = {
  emit(event: SessionEvent): void {
    for (const listener of listeners) listener(event);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
