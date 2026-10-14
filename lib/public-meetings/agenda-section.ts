/** A complete, contiguous agenda at the front of a packet, not embedded minutes.
 * Fail closed if numbering is missing/repeated or the closing boundary is absent.
 * Callers must independently prove that this text is native, not merged OCR.
 */
export function completeNativeAgendaSection(text: string): string | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex(line => /^\s*1[.)]\s+(?:adoption|approval) of (?:the )?agenda\b/i.test(line));
  if (first < 0 || first > 50) return null;
  const end = lines.findIndex((line, index) => index > first && /^\s*\d+[.)]\s+adjournment\b/i.test(line));
  if (end < 0) return null;
  const section = lines.slice(first, end + 1).join("\n");
  const headings = [...section.matchAll(/^\s*(\d+)[.)]\s+\S/gm)].map(match => Number(match[1]));
  if (headings.length < 3 || headings.length > 80 || headings.some((number, index) => number !== index + 1)) return null;
  return section;
}

/** Remove an independently aligned presenter column from TITLES only.
 * Original evidence is never changed. Require several person-like cells in the
 * same right-hand column; ordinary multi-space text is not enough evidence.
 */
export function agendaTitleText(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const cells = lines.flatMap(line => {
    const match = line.match(/ {2,}((?:(?:Dr|Mr|Ms|Mrs)\. )?[A-Z][a-z'’-]+(?: [A-Z][a-z'’-]+){1,3})\s*$/);
    if (!match) return [];
    const column = line.lastIndexOf(match[1]);
    return column >= 60 && column <= 110 ? [{ name: match[1], column }] : [];
  });
  const aligned = cells.filter(cell => cells.filter(other => Math.abs(cell.column - other.column) <= 5).length >= 3);
  if (aligned.length < 3) return text;
  return lines.map(line => {
    const cell = aligned.find(cell => line.trimEnd().endsWith(cell.name) && Math.abs(line.lastIndexOf(cell.name) - cell.column) <= 5);
    if (!cell) return line;
    const left = line.slice(0, line.lastIndexOf(cell.name)).trimEnd();
    return left.trim().length >= 10 ? left : line;
  }).join("\n");
}
