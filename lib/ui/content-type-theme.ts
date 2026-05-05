type ContentTypeTheme = {
  badge: string;
  subtle: string;
};

const CONTENT_TYPE_THEMES: Record<string, ContentTypeTheme> = {
  post: {
    badge: "border border-slate-800 bg-[linear-gradient(145deg,rgba(15,23,42,1),rgba(30,41,59,0.96))] text-white shadow-[0_10px_24px_-18px_rgba(15,23,42,0.95)]",
    subtle: "border border-slate-200 bg-slate-100/90 text-slate-700",
  },
  news: {
    badge: "border border-sky-200 bg-[linear-gradient(145deg,rgba(224,242,254,0.98),rgba(240,249,255,0.95))] text-sky-800 shadow-[0_10px_24px_-18px_rgba(14,165,233,0.85)]",
    subtle: "border border-sky-200 bg-sky-50/90 text-sky-700",
  },
  "news story": {
    badge: "border border-sky-200 bg-[linear-gradient(145deg,rgba(224,242,254,0.98),rgba(240,249,255,0.95))] text-sky-800 shadow-[0_10px_24px_-18px_rgba(14,165,233,0.85)]",
    subtle: "border border-sky-200 bg-sky-50/90 text-sky-700",
  },
  event: {
    badge: "border border-amber-200 bg-[linear-gradient(145deg,rgba(254,243,199,0.98),rgba(255,251,235,0.95))] text-amber-800 shadow-[0_10px_24px_-18px_rgba(245,158,11,0.75)]",
    subtle: "border border-amber-200 bg-amber-50/90 text-amber-700",
  },
  debate: {
    badge: "border border-violet-200 bg-[linear-gradient(145deg,rgba(237,233,254,0.98),rgba(245,243,255,0.95))] text-violet-800 shadow-[0_10px_24px_-18px_rgba(139,92,246,0.75)]",
    subtle: "border border-violet-200 bg-violet-50/90 text-violet-700",
  },
  poll: {
    badge: "border border-cyan-200 bg-[linear-gradient(145deg,rgba(207,250,254,0.98),rgba(236,254,255,0.95))] text-cyan-800 shadow-[0_10px_24px_-18px_rgba(6,182,212,0.8)]",
    subtle: "border border-cyan-200 bg-cyan-50/90 text-cyan-700",
  },
  petition: {
    badge: "border border-emerald-200 bg-[linear-gradient(145deg,rgba(209,250,229,0.98),rgba(236,253,245,0.95))] text-emerald-800 shadow-[0_10px_24px_-18px_rgba(16,185,129,0.82)]",
    subtle: "border border-emerald-200 bg-emerald-50/90 text-emerald-700",
  },
  case: {
    badge: "border border-rose-200 bg-[linear-gradient(145deg,rgba(255,228,230,0.98),rgba(255,241,242,0.95))] text-rose-800 shadow-[0_10px_24px_-18px_rgba(244,63,94,0.75)]",
    subtle: "border border-rose-200 bg-rose-50/90 text-rose-700",
  },
  interview: {
    badge: "border border-fuchsia-200 bg-[linear-gradient(145deg,rgba(250,232,255,0.98),rgba(253,244,255,0.95))] text-fuchsia-800 shadow-[0_10px_24px_-18px_rgba(217,70,239,0.78)]",
    subtle: "border border-fuchsia-200 bg-fuchsia-50/90 text-fuchsia-700",
  },
  audio: {
    badge: "border border-indigo-200 bg-[linear-gradient(145deg,rgba(224,231,255,0.98),rgba(238,242,255,0.95))] text-indigo-800 shadow-[0_10px_24px_-18px_rgba(99,102,241,0.8)]",
    subtle: "border border-indigo-200 bg-indigo-50/90 text-indigo-700",
  },
  podcast: {
    badge: "border border-indigo-200 bg-[linear-gradient(145deg,rgba(224,231,255,0.98),rgba(238,242,255,0.95))] text-indigo-800 shadow-[0_10px_24px_-18px_rgba(99,102,241,0.8)]",
    subtle: "border border-indigo-200 bg-indigo-50/90 text-indigo-700",
  },
  "ballot measure": {
    badge: "border border-orange-200 bg-[linear-gradient(145deg,rgba(255,237,213,0.98),rgba(255,247,237,0.95))] text-orange-800 shadow-[0_10px_24px_-18px_rgba(249,115,22,0.75)]",
    subtle: "border border-orange-200 bg-orange-50/90 text-orange-700",
  },
  "ballot question": {
    badge: "border border-orange-200 bg-[linear-gradient(145deg,rgba(255,237,213,0.98),rgba(255,247,237,0.95))] text-orange-800 shadow-[0_10px_24px_-18px_rgba(249,115,22,0.75)]",
    subtle: "border border-orange-200 bg-orange-50/90 text-orange-700",
  },
  "official response": {
    badge: "border border-blue-200 bg-[linear-gradient(145deg,rgba(219,234,254,0.98),rgba(239,246,255,0.95))] text-blue-800 shadow-[0_10px_24px_-18px_rgba(59,130,246,0.75)]",
    subtle: "border border-blue-200 bg-blue-50/90 text-blue-700",
  },
};

function normalizeContentTypeLabel(label: string) {
  return label.trim().toLowerCase();
}

export function getContentTypeTheme(label: string): ContentTypeTheme {
  const normalized = normalizeContentTypeLabel(label);

  if (CONTENT_TYPE_THEMES[normalized]) {
    return CONTENT_TYPE_THEMES[normalized];
  }

  if (normalized.includes("news")) return CONTENT_TYPE_THEMES.news;
  if (normalized.includes("event")) return CONTENT_TYPE_THEMES.event;
  if (normalized.includes("debate")) return CONTENT_TYPE_THEMES.debate;
  if (normalized.includes("poll") || normalized.includes("vote")) return CONTENT_TYPE_THEMES.poll;
  if (normalized.includes("petition")) return CONTENT_TYPE_THEMES.petition;
  if (normalized.includes("case")) return CONTENT_TYPE_THEMES.case;
  if (normalized.includes("audio") || normalized.includes("podcast")) return CONTENT_TYPE_THEMES.audio;
  if (normalized.includes("interview")) return CONTENT_TYPE_THEMES.interview;
  if (normalized.includes("ballot")) return CONTENT_TYPE_THEMES["ballot question"];
  if (normalized.includes("official")) return CONTENT_TYPE_THEMES["official response"];

  return CONTENT_TYPE_THEMES.post;
}
