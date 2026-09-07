import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PUBLIC_REPLACEMENTS = new Map<string, string | null>([
  ["data/generated/public-meetings.json", "data/generated/events-runtime.json"],
  ["data/generated/public-meeting-items.json", "data/generated/public-meeting-items-runtime.json"],
  ["data/generated/public-meeting-voting-cards.json", "data/generated/voting-cards-runtime.json"],
  ["data/generated/public-civic-cases.json", "data/generated/public-cases-runtime.json"],
  ["data/generated/public-meeting-official-actions.json", null],
]);

export function hasInstalledCivicRelease(root = process.cwd()) {
  const marker = path.join(root, "data/generated/civic-data-release.json");
  if (!existsSync(marker)) return false;
  const release = JSON.parse(readFileSync(marker, "utf8")) as { id?: string; createdAt?: string; sourceCommit?: string };
  if (!release || !/^[a-f0-9]{64}$/.test(release.id ?? "") || !Number.isFinite(Date.parse(release.createdAt ?? "")) || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(release.sourceCommit ?? "")) throw new Error("invalid_installed_civic_release_marker");
  return true;
}

// A restore writes this marker only after every release object passes its hash
// check. Repository copies of excluded worker datasets must then be ignored,
// including while Next prerenders pages before function tracing excludes them.
export function installedPublicArtifactPath(relative: string, root = process.cwd()) {
  if (PUBLIC_REPLACEMENTS.has(relative) && hasInstalledCivicRelease(root)) return PUBLIC_REPLACEMENTS.get(relative)!;
  return relative;
}
