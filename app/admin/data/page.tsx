import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getCivicDataMetrics } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

const adminLinks = [
  { href: "/admin/sources", label: "Data Sources" },
  { href: "/admin/imports", label: "Imports" },
  { href: "/admin/officials", label: "Officials" },
  { href: "/admin/elections", label: "Elections" },
  { href: "/admin/initiatives", label: "Initiatives" },
];

export default async function AdminDataPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const metrics = await getCivicDataMetrics();
  const metricCards = [
    { label: "Officials", value: metrics.officials },
    { label: "Elections", value: metrics.elections },
    { label: "Bills", value: metrics.bills },
    { label: "Initiatives", value: metrics.initiatives },
    { label: "Meetings", value: metrics.meetings },
    { label: "Ads", value: metrics.ads },
    { label: "Data Sources", value: metrics.dataSources },
  ];

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Nevada beta data"
        description="Monitor the normalized civic data foundation for Nevada government, local jurisdictions, UNR, and ASUN."
        actions={
          <div className="flex flex-wrap gap-2">
            {adminLinks.map((link) => (
              <Link key={link.href} href={link.href} className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
                {link.label}
              </Link>
            ))}
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-50">{metric.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-5">
        <h2 className="text-lg font-semibold text-slate-50">Data foundation scope</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          This phase tracks Nevada State Government, Nevada Legislature, Nevada Federal Delegation, Carson City, Reno, Washoe County,
          University of Nevada, Reno, and Associated Students of the University of Nevada.
        </p>
      </section>
    </div>
  );
}

