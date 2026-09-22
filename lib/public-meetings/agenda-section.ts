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
