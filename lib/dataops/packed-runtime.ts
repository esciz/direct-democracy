import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

// These large, repetitive public datasets are packed losslessly at build time.
// Workers keep the original JSON; local readers prefer it to any older build.
export const PACKED_CIVIC_FILES = ["public-meeting-votes.json", "nevada-community-relationships.json"] as const;
export const packedCivicPath = (file: string) => file.replace(/\.json$/, "-runtime.json.gz");

export function civicJsonPath(file: string): string | null {
  if (existsSync(file)) return file;
  const packed = packedCivicPath(file);
  if (PACKED_CIVIC_FILES.some(name => path.basename(file) === name) && existsSync(packed)) return packed;
  return null;
}

function decode<T>(file: string, bytes: Buffer): T {
  const text = file.endsWith(".gz") ? gunzipSync(bytes, { maxOutputLength: 256 * 1024 * 1024 }) : bytes;
  return JSON.parse(text.toString("utf8")) as T;
}

export async function readCivicJson<T>(file: string): Promise<T> {
  return decode<T>(file, await readFile(file));
}

export function readCivicJsonSync<T>(file: string): T {
  return decode<T>(file, readFileSync(file));
}
