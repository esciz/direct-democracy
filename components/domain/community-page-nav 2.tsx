"use client";

const links = [
  { href: "#briefing", label: "Start here" },
  { href: "#events", label: "Next meeting" },
  { href: "#decisions", label: "Decisions" },
  { href: "#officials", label: "People" },
  { href: "#more", label: "More" },
];

export function CommunityPageNav() {
  return (
    <nav aria-label="Community page sections" className="sticky top-3 z-20 -mx-1 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/85 p-1.5 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="flex min-w-max items-center gap-1">
        <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Jump to</span>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-cyan-400/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
