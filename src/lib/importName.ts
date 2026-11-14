function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function importedFileName(raw: string, fallback: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw;
  let name = safeDecode(base).trim();
  if (/^(document|msf|content):/i.test(name)) {
    name = name.split(':').pop()?.trim() ?? name;
  }
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}
