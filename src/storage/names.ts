export function splitExtension(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { stem: name, ext: '' };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

export function withCollisionSuffix(name: string, index: number): string {
  const { stem, ext } = splitExtension(name);
  return `${stem} (${index})${ext}`;
}

const COLLISION_SUFFIX = / \(\d+\)$/;

export function uniqueFileName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;

  const { stem, ext } = splitExtension(name);
  const base = `${stem.replace(COLLISION_SUFFIX, '')}${ext}`;
  if (!taken.has(base)) return base;

  for (let index = 2; ; index += 1) {
    const candidate = withCollisionSuffix(base, index);
    if (!taken.has(candidate)) return candidate;
  }
}
