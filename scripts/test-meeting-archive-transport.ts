import assert from "node:assert/strict";
import { fetchPublicMeetingArchiveText } from "../lib/public-meetings/importer";

async function main() {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; headers: Headers; signal: AbortSignal | null | undefined }> = [];
  const mock = (next: number[]) => {
    calls.length = 0;
    const statuses = [...next];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers), signal: init?.signal });
      const responseStatus = statuses.shift() ?? 500;
      return new Response(responseStatus === 200 ? "<html>Published official event</html>" : "Service unavailable", { status: responseStatus });
    }) as typeof fetch;
  };
  const calendar = "https://events.eurekacountynv.gov/meetings";
  try {
    mock([502, 200]);
    assert.equal(await fetchPublicMeetingArchiveText(calendar), "<html>Published official event</html>");
    assert.equal(calls.length, 2, "One transient official-origin failure gets one bounded retry");
    assert.ok(calls.every((call) => call.url === calendar && call.headers.get("user-agent") === "Direct Democracy civic meeting collector"));
    assert.ok(calls.every((call) => call.headers.get("accept")?.includes("text/html") && call.signal instanceof AbortSignal));
    mock([502, 503, 200]);
    await assert.rejects(fetchPublicMeetingArchiveText(calendar), /Fetch failed 503/);
    assert.equal(calls.length, 2, "Repeated source failures remain explicit and retries stop");
    mock([403, 200]);
    await assert.rejects(fetchPublicMeetingArchiveText(calendar), /Fetch failed 403/);
    assert.equal(calls.length, 1, "Access errors do not trigger a retry or transport substitution");
    mock([502, 200]);
    await assert.rejects(fetchPublicMeetingArchiveText("https://www.eurekacountynv.gov/departments/commissioners/"), /Fetch failed 502/);
    assert.equal(calls.length, 1, "Compatibility handling is limited to the exact event host");
    assert.match(calls[0].headers.get("user-agent")!, /archive backfill/);
    console.log("Meeting archive transport: exact Eureka host, identifying compatible headers, one transient retry, final failure visibility and no access-error retries passed.");
  } finally { globalThis.fetch = original; }
}
void main();
