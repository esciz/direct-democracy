import Link from "next/link";
import { redirect } from "next/navigation";

import { ManualCandidateImportClient } from "@/components/domain/manual-candidate-import-client";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

export default async function ManualCandidatesImportPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin Import Fallback"
        title="Manual candidate data import"
        description="Import official candidate rows from downloaded files or copied official table content when source pages cannot be fetched reliably by the server."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/imports" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Import Runs
            </Link>
            <Link href="/admin/elections/qa" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Election QA
            </Link>
          </div>
        }
      />

      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-5 text-sm leading-7 text-cyan-50">
        This fallback does not scrape or bypass protected pages. Use it only with official data you downloaded, copied, or exported from the source website.
      </section>

      <ManualCandidateImportClient />
    </div>
  );
}
