import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { BrowserContext } from "playwright";

async function main() {
  const originalCwd = process.cwd();
  const root = mkdtempSync(path.join(os.tmpdir(), "dd-bootstrap-budget-test-"));
  process.chdir(root);
  try {
    const { collectProvider, createBootstrapBudget, BootstrapBudgetExceeded, orderBootstrapWork, scheduledBootstrapDuration } = await import(pathToFileURL(path.join(originalCwd, "scripts/bootstrap-public-meeting-sources.ts")).href);
    assert.equal(scheduledBootstrapDuration(900000), 720000);
    assert.equal(scheduledBootstrapDuration(900000, 9999999), 810000, "Configured budget must reserve cleanup time before the command timeout");
    assert.equal(scheduledBootstrapDuration(600000), 510000);
    let clock = 0;
    const budget = createBootstrapBudget(100, () => clock);
    assert.equal(budget.timeout(45000), 100);
    clock = 75;
    assert.equal(budget.timeout(45000), 25, "Every operation timeout must fit the remaining budget");
    clock = 100;
    assert.throws(() => budget.timeout(45000), BootstrapBudgetExceeded);
    await assert.rejects(createBootstrapBudget(5).run(() => new Promise(() => {})), BootstrapBudgetExceeded);
    assert.deepEqual(orderBootstrapWork([
      { id: "recent-failure", last: "2026-09-07T01:00:00Z" },
      { id: "never-attempted", last: null },
      { id: "older-attempt", last: "2026-09-01T01:00:00Z" },
    ], (row: { last: string | null }) => row.last).map((row: { id: string }) => row.id), ["never-attempted", "older-attempt", "recent-failure"]);

    const providerRoot = path.join(root, "data/manual-sources/public-meetings/fixture");
    mkdirSync(providerRoot, { recursive: true });
    const manifestPath = path.join(providerRoot, "manifest.json");
    const retained = { localPath: "minutes/reviewed.pdf", officialSourceUrl: "https://fixture.gov/reviewed.pdf", parserStatus: "parsed", meetingDate: "2026-01-01", notes: "Reviewed retained evidence" };
    writeFileSync(manifestPath, JSON.stringify({ entries: [retained], failures: [], collection: { lastSucceededAt: "2026-09-01T00:00:00Z" } }));
    const load = () => JSON.parse(readFileSync(manifestPath, "utf8"));
    const provider = {
      id: "fixture", sourceName: "Fixture Board", governingBody: "Fixture Board", officialSourceUrl: "https://fixture.gov/meetings",
      includeHosts: ["fixture.gov"],
      folderMap: { agenda: "agendas", packet: "packets", minutes: "minutes", video: "pages", vote: "metadata", bill: "metadata", journal: "metadata", rawHtml: "pages", apiJson: "metadata" },
      pages: ["a", "b", "c"].map((name) => ({ url: `https://fixture.gov/${name}`, sourceKind: "rawHtml", titleHint: name, notes: "Official fixture" })),
    };
    const visited: string[] = [];
    let failFirst = true;
    let links: { href: string; label: string }[] = [];
    const downloaded: string[] = [];
    let captureResponse: ((response: unknown) => void) | null = null;
    let emitJson = false;
    const page = {
      on(_event: string, callback: (response: unknown) => void) { captureResponse = callback; }, off() {}, async close() {},
      async goto(url: string) {
        visited.push(url);
        if (failFirst) { failFirst = false; clock = 100; throw new Error("ETIMEDOUT official source connection"); }
        if (url.endsWith("/c")) assert.ok(load().entries.some((entry: { officialSourceUrl?: string }) => entry.officialSourceUrl?.endsWith("/b")), "A completed page must already be durably checkpointed before the next page starts");
        if (emitJson) captureResponse?.({ url: () => "https://fixture.gov/api/meetings", headers: () => ({ "content-type": "application/json" }), ok: () => true, async body() { await new Promise((resolve) => setTimeout(resolve, 5)); return Buffer.from(JSON.stringify({ id: 99, title: "Fixture public meeting", date: "2026-09-07" })); } });
      },
      async waitForLoadState() {}, async title() { return visited.at(-1)!.split("/").at(-1)!; },
      locator() { return { async innerText() { return "Official civic meeting source text. ".repeat(20); } }; },
      async content() { return "<html>Preserved official source</html>"; }, url() { return visited.at(-1)!; },
      async $$eval() { return links; },
    };
    const context = { async newPage() { return page; }, request: { async get(url: string) { downloaded.push(url); throw new Error("ETIMEDOUT public document request"); } } } as unknown as BrowserContext;
    clock = 0;
    const first = await collectProvider(provider, context, createBootstrapBudget(100, () => clock));
    assert.equal(first.failed, 1);
    assert.deepEqual(visited, ["https://fixture.gov/a"]);
    assert.deepEqual(load().entries, [retained], "Budget exhaustion must preserve reviewed evidence and existing manifest rows");
    assert.equal(load().collection.status, "partial");
    assert.equal(load().collection.budgetReached, true);
    assert.equal(load().collection.lastSucceededAt, "2026-09-01T00:00:00Z", "A failed attempt must not erase earlier successful collection provenance");
    assert.match(load().failures[0].reason, /ETIMEDOUT/, "Transient source timeouts remain explicit failures");
    visited.length = 0;
    await collectProvider(provider, context, createBootstrapBudget(10000));
    assert.deepEqual(visited, ["https://fixture.gov/b", "https://fixture.gov/c", "https://fixture.gov/a"], "Deferred pages must run before the page that consumed the previous budget");
    assert.ok(load().entries.some((entry: { localPath: string }) => entry.localPath === retained.localPath));
    assert.equal(load().collection.status, "completed");

    const linkProvider = { ...provider, pages: [provider.pages[0]] };
    links = Array.from({ length: 20 }, (_, i) => ({ href: `https://fixture.gov/minutes-${i}.pdf`, label: `Minutes document ${i}` }));
    await collectProvider(linkProvider, context, createBootstrapBudget(10000));
    assert.equal(downloaded.length, 16);
    assert.equal(load().collection.linkedFilesDeferred, 4);
    assert.equal(load().collection.status, "partial", "A capped download pass must report its remaining discovered documents");
    downloaded.length = 0;
    await collectProvider(linkProvider, context, createBootstrapBudget(10000));
    assert.deepEqual(downloaded.slice(0, 4), links.slice(16).map((link) => link.href), "Download caps must not permanently starve links beyond the initial page slice");
    assert.equal(load().failures.length, 21, "All source failures remain visible while untouched documents rotate ahead of retries");
    links = [];
    emitJson = true;
    await collectProvider(linkProvider, context, createBootstrapBudget(10000));
    assert.ok(load().entries.some((entry: { fileType?: string; officialSourceUrl?: string }) => entry.fileType === "json" && entry.officialSourceUrl === "https://fixture.gov/api/meetings"), "Pending public JSON responses within budget must be saved before closing their page");
    console.log("Browser bootstrap budgets, atomic partial checkpoints, timeout evidence, provider/page/link rotation and retained source records passed; no network or shared data writes.");
  } finally {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  }
}
void main();
