import type { SentimentHistoryPoint } from "@/types/domain";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(seed: string) {
  let total = 0;

  for (let index = 0; index < seed.length; index += 1) {
    total = (total * 31 + seed.charCodeAt(index)) % 1000003;
  }

  return total;
}

function monthLabel(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - offset);
  return date.toLocaleDateString("en-US", { month: "short" });
}

function isoDate(offset: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - offset);
  return date.toISOString();
}

export function buildSentimentHistory(seed: string, currentSupport: number, options?: { points?: number; opposeBias?: number; labelPrefix?: string }) {
  const points = options?.points ?? 6;
  const seedValue = hashSeed(seed);
  const opposeBias = options?.opposeBias ?? 24;
  const history: SentimentHistoryPoint[] = [];
  const supportBase = clamp(currentSupport, 24, 78);

  for (let index = points - 1; index >= 0; index -= 1) {
    const wave = (((seedValue + index * 17) % 9) - 4) * 1.8;
    const drift = (points - 1 - index) * 1.4;
    const supportPercent = clamp(Math.round(supportBase - drift + wave), 18, 84);
    const opposePercent = clamp(Math.round(opposeBias + (((seedValue + index * 11) % 7) - 3) * 1.7), 8, 52);
    const undecidedPercent = clamp(100 - supportPercent - opposePercent, 4, 42);
    const normalizedSupport = clamp(100 - opposePercent - undecidedPercent, 18, 84);

    history.push({
      label: options?.labelPrefix ? `${options.labelPrefix} ${points - index}` : monthLabel(index),
      date: isoDate(index),
      supportPercent: normalizedSupport,
      opposePercent,
      undecidedPercent,
    });
  }

  return history;
}

export function getLatestSupport(history: SentimentHistoryPoint[]) {
  return history.at(-1)?.supportPercent ?? 0;
}
