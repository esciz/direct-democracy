import Link from "next/link";

import { PetitionList } from "@/components/domain/petition-list";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getVerificationLabel } from "@/lib/auth/verification";
import { getAllPetitions } from "@/lib/petitions/store";

type PetitionsPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function PetitionsPage({ searchParams }: PetitionsPageProps) {
  const user = await getCurrentUser();
  const petitions = await getAllPetitions();
  const params = searchParams ? await searchParams : undefined;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Petitions"
        title="Jurisdiction petitions"
        description="Track local petition momentum, signature counts, and co-sponsorship eligibility in one place."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {petitions.length} open petitions
            </span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {user.isVerifiedVoter ? `Verified in ${user.jurisdictionName}` : getVerificationLabel(user.verificationState)}
            </span>
          </>
        }
        actions={
          <Link
            href="/petitions/create"
            className="inline-flex rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
          >
            Create petition
          </Link>
        }
      />
      {params?.error === "verification" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Only verified users can create and sign petitions.
        </section>
      ) : null}
      <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Your petition access</p>
          <p className="mt-2 text-sm text-slate-600">
            {user.isVerifiedVoter
              ? `You can create and sign petitions in ${user.jurisdictionName}.`
              : "Campus access stays open, but voter verification is required before creating or signing petitions."}
          </p>
        </div>
      </div>
      <PetitionList petitions={petitions} />
    </div>
  );
}
