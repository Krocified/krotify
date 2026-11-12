export type Bump = 'major' | 'minor' | 'patch';

function parseTag(tag: string | null): { major: number; minor: number; patch: number } | null {
  if (!tag) return null;
  const match = tag.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function classifyCommits(messages: string[]): Bump {
  let bump: Bump = 'patch';
  for (const message of messages) {
    const subject = (message.split('\n')[0] ?? '').trim();
    if (!subject || /^merge\b/i.test(subject)) continue;
    const breaking = /^[a-z]+(\([^)]*\))?!:/i.test(subject) || /^BREAKING[ -]CHANGE:/im.test(message);
    if (breaking) return 'major';
    if (/^feat(\([^)]*\))?:/i.test(subject)) bump = 'minor';
  }
  return bump;
}

export function nextVersion(
  latestTag: string | null,
  bump: Bump,
): { version: string; versionCode: number; tag: string } {
  const base = parseTag(latestTag) ?? { major: 0, minor: 0, patch: 0 };
  let { major, minor, patch } = base;
  if (!latestTag) {
    major = 0;
    minor = 1;
    patch = 0;
  } else if (bump === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bump === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  const version = `${major}.${minor}.${patch}`;
  return { version, versionCode: major * 10000 + minor * 100 + patch, tag: `v${version}` };
}

export function detectBump(
  latestTag: string | null,
  messages: string[],
  override: 'auto' | Bump,
): Bump {
  if (override !== 'auto') return override;
  return classifyCommits(messages);
}

function arg(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

async function main() {
  const { readFile } = await import('node:fs/promises');
  const latest = arg('latest') || null;
  const override = (arg('bump') || 'auto') as 'auto' | Bump;
  const commitsFile = arg('commits');
  const raw = commitsFile ? await readFile(commitsFile, 'utf8') : '';
  const messages = raw.split('\u0000').map((item) => item.trim()).filter(Boolean);
  const bump = detectBump(latest, messages, override);
  const result = nextVersion(latest, bump);
  console.log(`version=${result.version}`);
  console.log(`versionCode=${result.versionCode}`);
  console.log(`tag=${result.tag}`);
  console.log(`bump=${bump}`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  await main();
}
