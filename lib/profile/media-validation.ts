const BLOCKED_PROFILE_IMAGE_TERMS = [
  "badge",
  "banner",
  "default",
  "favicon",
  "icon",
  "logo",
  "outline",
  "placeholder",
  "seal",
  "share-your-thoughts",
  "symbol",
  "trout",
];

export function getValidatedProfileImageUrl(value: string | null | undefined) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol)) return null;

    const searchableValue = decodeURIComponent(`${url.hostname}${url.pathname}`).toLowerCase();
    if (searchableValue.endsWith(".svg")) return null;
    if (BLOCKED_PROFILE_IMAGE_TERMS.some((term) => searchableValue.includes(term))) return null;

    return url.toString();
  } catch {
    return null;
  }
}

export function isUsableProfileImageUrl(value: string | null | undefined) {
  return Boolean(getValidatedProfileImageUrl(value));
}
