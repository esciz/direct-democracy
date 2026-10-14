import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const fixture = mkdtempSync(path.join(os.tmpdir(), "dd-ocr-capability-"));
const bin = path.join(fixture, "bin with spaces");
mkdirSync(bin); mkdirSync(path.join(fixture, "data/generated"), { recursive: true });
try {
  for (const command of ["pdfinfo", "pdftotext", "pdftoppm", "tesseract"]) {
    const file = path.join(bin, command);
    writeFileSync(file, "#!/bin/sh\nprintf 'fixture version 1.0\\n'\n"); chmodSync(file, 0o755);
  }
  assert.equal(existsSync(path.join(bin, "command")), false, "Fixture deliberately has no external command executable, matching Linux");
  const run = () => {
    const result = spawnSync(process.execPath, ["--import", require.resolve("tsx"), path.resolve("scripts/audit-ocr-capabilities.ts")], {
      cwd: fixture, env: { ...process.env, PATH: bin }, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(readFileSync(path.join(fixture, "data/generated/dataops-ocr-capabilities.json"), "utf8"));
  };
  let audit = run();
  assert.equal(audit.capabilities.canRunPageOcr, true);
  assert.equal(audit.capabilities.canExtractNativePdfText, true);
  assert.equal(audit.capabilities.canRunOcrMyPdf, false, "A missing optional binary must remain unavailable");
  assert.equal(audit.tools.find((row: { command: string }) => row.command === "pdftoppm").path, path.join(bin, "pdftoppm"), "Executable paths with spaces remain intact");
  rmSync(path.join(bin, "tesseract"));
  audit = run();
  assert.equal(audit.capabilities.canRunPageOcr, false, "Missing OCR engine must fail capability detection");
  assert.equal(audit.capabilities.canExtractNativePdfText, true);
  console.log("OCR capability detection passed: shell-builtin-only environment, executable paths with spaces, and missing tool boundaries.");
} finally { rmSync(fixture, { recursive: true, force: true }); }
