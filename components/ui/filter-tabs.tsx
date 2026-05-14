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
    <div className="flex flex-wrap gap-2 rounded-[1.35rem] border border-white/10 bg-white/5 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          scroll={false}
          className={
            tab.active
              ? "inline-flex rounded-full bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_14px_28px_-18px_rgba(45,212,191,0.75)]"
              : "inline-flex rounded-full px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/8 hover:text-white"
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
