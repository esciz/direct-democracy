export function formatUnknownError(error: unknown, fallback = "An unexpected error occurred.") {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof Event !== "undefined" && error instanceof Event) {
    const target = "target" in error ? (error.target as { src?: string; href?: string } | null) : null;
    const source = target?.src ?? target?.href;

    return source
      ? `A browser ${error.type} event interrupted loading for ${source}.`
      : `A browser ${error.type} event interrupted loading.`;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }

  try {
    return JSON.stringify(error) || fallback;
  } catch {
    return fallback;
  }
}
