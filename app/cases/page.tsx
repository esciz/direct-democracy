import { CaseCard } from "@/components/domain/case-card";
import { PageIntro } from "@/components/ui/page-intro";
import { isGuestUser } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getAllCases } from "@/lib/cases/store";

type CasesPageProps = {
  searchParams?: Promise<{
    follow?: string;
    support?: string;
    theme?: string;
    themeSupport?: string;
    error?: string;
  }>;
};

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const user = await getCurrentUser();
  const [cases, params] = await Promise.all([getAllCases(user), searchParams ? searchParams : Promise.resolve(undefined)]);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Cases"
        title="Public-interest cases"
        description="Follow court issues that affect public life, add short support statements, and help shape community-backed brief themes without turning the platform into a legal filing system."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {cases.length} seeded cases
            </span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              Public support, not legal filing
            </span>
          </>
        }
      />
      {params?.follow === "added" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Case added to your followed issues.
        </section>
      ) : null}
      {params?.follow === "removed" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Case removed from your followed issues.
        </section>
      ) : null}
      {params?.support === "saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your public case support was saved.
        </section>
      ) : null}
      {params?.theme === "created" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your community brief theme was added.
        </section>
      ) : null}
      {params?.themeSupport ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Theme support was updated.
        </section>
      ) : null}
      {params?.error ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          That case action could not be completed. Check verification, permissions, or statement length and try again.
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Safety and scope</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Cases is for public support and community input. It does not offer legal advice, attorney-client relationships, or direct court filing.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {cases.map((caseItem) => (
          <CaseCard key={caseItem.id} caseItem={caseItem} guestMode={isGuestUser(user)} />
        ))}
      </div>
    </div>
  );
}
