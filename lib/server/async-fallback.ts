import "server-only";

type BoundedFallbackOptions = {
  label: string;
  timeoutMs?: number;
};

export async function withBoundedFallback<T>(
  operation: Promise<T>,
  fallback: T,
  { label, timeoutMs = 1500 }: BoundedFallbackOptions,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => {
          console.warn(`[data-fallback] ${label} timed out after ${timeoutMs}ms`);
          resolve(fallback);
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error(`[data-fallback] ${label} failed`, error);
    return fallback;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
