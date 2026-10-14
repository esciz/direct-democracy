import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getAdminBallotQuestions } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function getOutcomeLabel(value: boolean | null) {
  if (value === true) return "Passed";
  if (value === false) return "Failed";
  return "Pending";
}

export default async function AdminBallotMeasuresPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const questions = await getAdminBallotQuestions();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Ballot measures"
        description="Review imported ballot questions, initiative petition status, outcomes, and source attribution."
        actions={
          <Link href="/admin/elections/qa" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            QA
          </Link>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1fr_0.8fr_0.7fr_0.6fr_0.7fr]">
          <span>Measure</span>
          <span>Election</span>
          <span>Jurisdiction</span>
          <span>Outcome</span>
          <span>Source</span>
        </div>
        <div className="divide-y divide-white/10">
          {questions.length > 0 ? (
            questions.map((question) => (
              <article key={question.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1fr_0.8fr_0.7fr_0.6fr_0.7fr]">
                <div>
                  <p className="font-semibold text-slate-50">{question.questionNumber ? `${question.questionNumber}: ` : ""}{question.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {question.questionType.replaceAll("_", " ")} · {question.petitionStatus.replaceAll("_", " ")}
                  </p>
                </div>
                <p className="text-slate-300">{question.electionTitle}</p>
                <p className="text-slate-300">{question.jurisdictionName}</p>
                <p className="font-semibold text-slate-100">{getOutcomeLabel(question.passed)}</p>
                <p className="text-slate-400">{question.sourceName ?? "No source"}</p>
              </article>
            ))
          ) : (
            <p className="px-4 py-8 text-sm text-slate-400">No imported ballot measures are available yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
