const OWNED_PREFIX = 'own:';

function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function ownedTrackId(uuid?: () => string): string {
  const value = uuid ? uuid() : (globalThis.crypto?.randomUUID?.() ?? fallbackUuid());
  return `${OWNED_PREFIX}${value}`;
}

export function isOwnedId(id: string): boolean {
  return id.startsWith(OWNED_PREFIX);
}
