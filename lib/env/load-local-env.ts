import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ORIGINAL_ENV_KEYS = new Set(Object.keys(process.env));

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;
  const key = match[1];
  let value = match[2] ?? "";
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (ORIGINAL_ENV_KEYS.has(parsed.key)) continue;
    process.env[parsed.key] = parsed.value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");
