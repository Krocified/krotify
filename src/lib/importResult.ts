export function importResultMessage(added: number, failed: number): string {
  if (added === 0) return failed > 0 ? 'No files were imported' : '';
  const imported = `${added} file${added === 1 ? '' : 's'} imported`;
  return failed > 0 ? `${imported}, ${failed} failed` : imported;
}
