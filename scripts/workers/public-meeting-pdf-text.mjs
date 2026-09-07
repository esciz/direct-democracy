import { readFileSync, statSync } from "node:fs";
import { PDFParse } from "pdf-parse";

// If the collector stops, terminate its worker rather than leaving an orphan parser.
process.on("disconnect", () => process.exit(1));

const [filePath, maxBytesValue, maxTextCharsValue] = process.argv.slice(2);
const maxBytes = Number(maxBytesValue);
const maxTextChars = Number(maxTextCharsValue);
try {
  if (!filePath || !Number.isFinite(maxBytes) || !Number.isFinite(maxTextChars) || statSync(filePath).size > maxBytes) throw new Error("PDF size or extraction limit is invalid");
  const parser = new PDFParse({ data: readFileSync(filePath) });
  let text;
  try { text = (await parser.getText()).text ?? ""; }
  finally { await parser.destroy(); }
  process.send?.({ text: text.slice(0, maxTextChars) }, () => process.exit(0));
} catch (error) {
  process.send?.({ error: error instanceof Error ? error.message : String(error) }, () => process.exit(1));
}
