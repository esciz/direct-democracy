export type PublicSourceHealth = {
  checkedAt: string;
  lastSuccessfulAt: string | null;
  ok: boolean;
  status: number | null;
  finalUrl: string;
  error: string | null;
  outcome: "reachable" | "access_restricted" | "challenge" | "failed";
};

export async function checkPublicSource(url: string, previous?: { ok: boolean; status: number | null; checkedAt: string; lastSuccessfulAt?: string | null } | null, timeoutMs = 12_000): Promise<PublicSourceHealth> {
  const checkedAt = new Date().toISOString();
  const priorSuccess = previous?.lastSuccessfulAt ?? (previous?.ok && previous.status && previous.status < 400 ? previous.checkedAt : null);
  let status: number | null = null; let finalUrl = url;
  try {
    const response = await fetch(url, { headers: { accept: "text/html,application/json;q=0.9,*/*;q=0.5", "user-agent": "Direct Democracy public civic source monitor" }, signal: AbortSignal.timeout(timeoutMs) });
    status = response.status; finalUrl = response.url || url;
    if (!response.ok) {
      await response.body?.cancel();
      return { checkedAt, lastSuccessfulAt: priorSuccess, ok: false, status, finalUrl, outcome: status === 401 || status === 403 || status === 429 ? "access_restricted" : "failed", error: `HTTP ${status} ${response.statusText}` };
    }
    const reader = response.body?.getReader(); let sample = ""; let bytes = 0; const decoder = new TextDecoder();
    try { if (reader) for (;;) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length; sample += decoder.decode(chunk.value, { stream: true }); if (bytes >= 64 * 1024) break; } }
    finally { await reader?.cancel().catch(() => undefined); }
    const challenge = /<title[^>]*>\s*(?:just a moment|attention required|access denied|robot check)|cf-chl-|please (?:complete the security check|verify (?:that )?you are (?:a )?human)|captcha-delivery\.com/i.test(sample);
    return { checkedAt, lastSuccessfulAt: challenge ? priorSuccess : checkedAt, ok: !challenge, status, finalUrl, outcome: challenge ? "challenge" : "reachable", error: challenge ? "Automated request received a security challenge; no content verification was performed." : null };
  } catch (error) { return { checkedAt, lastSuccessfulAt: priorSuccess, ok: false, status, finalUrl, outcome: "failed", error: error instanceof Error ? error.message : String(error) }; }
}

export async function mapConcurrent<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length); let index = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => { for (;;) { const current = index++; if (current >= items.length) break; results[current] = await work(items[current]); } }));
  return results;
}
