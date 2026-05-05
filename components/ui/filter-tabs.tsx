import Link from "next/link";

type FilterTab = {
  label: string;
  href: string;
  active: boolean;
};

type FilterTabsProps = {
  tabs: FilterTab[];
};

export function FilterTabs({ tabs }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[1.35rem] border border-white/70 bg-white/65 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          scroll={false}
          className={
            tab.active
              ? "inline-flex rounded-full bg-[linear-gradient(135deg,#0f172a,#0f766e)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.85)]"
              : "inline-flex rounded-full px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-civic-700"
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
