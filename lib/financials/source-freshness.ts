type SourceHealth = {
  attempted?: number;
  cachedAfterError?: number;
  unavailable?: number;
  attempts?: Array<{
    url?: string; status?: string; attemptedAt?: string | null;
    fetchedAt?: string | null; timestampBasis?: string | null;
  }>;
};

export function financeFreshnessFailures(health: SourceHealth | undefined): string[] {
  if (!health || !health.attempted) return ["Source freshness was not verified by a network refresh."];
  const failures: string[] = [];
  if (health.cachedAfterError) failures.push(`${health.cachedAfterError} source requests retained older cached data after retrieval failed.`);
  if (health.unavailable) failures.push(`${health.unavailable} source requests have no usable data.`);
  return failures;
}

function sourceKey(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.searchParams.sort();
    return url.toString();
  } catch { return null; }
}

export function financialSourceFreshness(value: unknown, sourceUrl: string, snapshotCheckedAt?: string | null) {
  const health = value && typeof value === "object" ? value as SourceHealth : undefined;
  const key = sourceKey(sourceUrl);
  if (!key) return null;
  const attempts = Array.isArray(health?.attempts) ? health.attempts : [];
  const attempt = attempts.filter(row => row && typeof row.url === "string" && sourceKey(row.url) === key)
    .sort((a, b) => (Date.parse(b.attemptedAt ?? "") || 0) - (Date.parse(a.attemptedAt ?? "") || 0))[0];
  if (!attempt) return null;
  // A frozen release must not downgrade a newer independently updated snapshot.
  const observedAt = Math.max(Date.parse(attempt.attemptedAt ?? "") || 0, attempt.timestampBasis === "retrieval_metadata" ? Date.parse(attempt.fetchedAt ?? "") || 0 : 0);
  if (snapshotCheckedAt && Date.parse(snapshotCheckedAt) > observedAt && observedAt > 0) return null;
  const retrievedAt = attempt.timestampBasis === "retrieval_metadata" && attempt.fetchedAt && Number.isFinite(Date.parse(attempt.fetchedAt)) ? attempt.fetchedAt : null;
  const blocked = attempt.status === "cached_after_error" || attempt.status === "unavailable";
  return {
    retrievedAt,
    note: blocked
      ? "Source refresh unavailable. Showing previously saved totals; newer filings may be missing."
      : !retrievedAt ? "Source retrieval date unknown. Saved totals have not been verified current." : null,
  };
}

export function withoutUnverifiedRetrievalDate(value: string) {
  return value.replace(/source (?:checked|retrieved) \d{4}-\d{2}-\d{2}/g, "source retrieval date unknown");
}
