type CourtRecord = { id?: string; caseNumber?: string | null; courtName?: string | null; sourceUrl?: string | null; courtLevel?: string | null; reviewStatus?: string | null; publicVisibilityStatus?: string | null; isRealCourtRecord?: boolean; metadata?: { federalCourtLayer?: unknown } | null };
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
export function courtRecordKey(record: CourtRecord) { return record.caseNumber && record.courtName ? `${normalize(record.courtName)}:${normalize(record.caseNumber)}` : record.id ?? ""; }
export function federalCourtLayer(record: CourtRecord) {
  const explicit = normalize(typeof record.metadata?.federalCourtLayer === "string" ? record.metadata.federalCourtLayer : "");
  const name = normalize(record.courtName ?? "");
  let hostname = ""; try { hostname = new URL(record.sourceUrl ?? "").hostname; } catch { /* No host evidence. */ }
  if (explicit === "us supreme" || name.includes("supreme court of the united states") || hostname === "supremecourt.gov" || hostname.endsWith(".supremecourt.gov")) return "us_supreme";
  const federal = record.courtLevel === "federal" || /(?:^|\.)(?:ca\d+|uscourts)\.uscourts\.gov$/.test(hostname) || hostname.endsWith(".uscourts.gov");
  if (!federal) return null;
  if (explicit === "circuit appellate" || name.includes("court of appeals") || name.includes("ninth circuit") || /(?:^|\.)ca\d+\.uscourts\.gov$/.test(hostname)) return "circuit_appellate";
  return "district";
}
export function isStateAppellateCase(record: CourtRecord) { return !federalCourtLayer(record) && (record.courtLevel === "appellate" || /\bnevada (?:supreme court|court of appeals)\b/i.test(record.courtName ?? "")); }
export function mergeReviewedCourtRecords<T extends CourtRecord>(existing: T[], incoming: T[], mentioned: CourtRecord[]) {
  const replacedKeys = new Set(mentioned.map(courtRecordKey)); const replacedIds = new Set(mentioned.map((row) => row.id).filter(Boolean));
  const preserved = existing.filter((row) => row.isRealCourtRecord && ["approved", "verified"].includes(row.reviewStatus ?? "") && row.publicVisibilityStatus === "public" && !replacedKeys.has(courtRecordKey(row)) && !replacedIds.has(row.id));
  return [...new Map([...preserved, ...incoming].map((row) => [courtRecordKey(row), row])).values()];
}
