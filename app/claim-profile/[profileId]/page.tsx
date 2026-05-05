import Link from "next/link";
import { notFound } from "next/navigation";

import { completeMatchedProfileClaim } from "@/lib/auth/actions";
import { getCurrentSessionUser } from "@/lib/server/auth-session";
import { getCandidateProfileById, getOfficialById } from "@/lib/server/elections-context";
import { getClaimMatchForProfile, getOnboardingDraft, type ClaimMatchStatus } from "@/lib/server/onboarding";

type ClaimProfilePageProps = {
  params: Promise<{
    profileId: string;
  }>;
};

export default async function ClaimProfilePage({ params }: ClaimProfilePageProps) {
  const { profileId } = await params;
  const sessionUser = await getCurrentSessionUser();
  const draft = await getOnboardingDraft();

  const candidate = await getCandidateProfileById(profileId);

  const hasVerificationAttempt = Boolean(
    draft?.legalFirstName && draft?.legalLastName && draft?.dateOfBirth && draft?.streetAddress && draft?.jurisdictionName,
  );

  function renderClaimBody(args: {
    heading: string;
    profileLabel: string;
    jurisdictionName: string;
    status: ClaimMatchStatus;
  }) {
    return (
      <div className="max-w-3xl space-y-5">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
            Unclaimed Profile
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{args.heading}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {args.profileLabel} · {args.jurisdictionName}
            </p>
          </div>
        </div>

        {!sessionUser ? (
          <div className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-ink">Start with account creation and identity verification</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              Claiming starts with a citizen account, then a voter-record identity match. Candidate and official access only opens after that verified identity aligns with a public profile.
            </p>
            <Link
              href={`/get-started?step=account&claimProfile=${profileId}`}
              className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sign up to claim this profile
            </Link>
          </div>
        ) : args.status === "eligible" ? (
          <div className="rounded-3xl bg-civic-50 p-5">
            <h2 className="text-lg font-semibold text-ink">Verified match confirmed</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              Your legal identity, voter record, and jurisdiction data match this public profile strongly enough to continue. This is how Direct Democracy upgrades a citizen account into a claimed public role.
            </p>
            <form action={completeMatchedProfileClaim} className="mt-5">
              <input type="hidden" name="profileId" value={profileId} />
              <button type="submit" className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Complete profile claim
              </button>
            </form>
          </div>
        ) : args.status === "needsReview" ? (
          <div className="rounded-3xl bg-orange-50 p-5">
            <h2 className="text-lg font-semibold text-ink">Possible match needs manual review</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              Some of your verified details line up with this public profile, but the match is not strong enough for an automatic claim. This usually means a common-name or partial-record ambiguity that needs a stricter review path.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/get-started?step=verify&claimProfile=${profileId}`}
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Review identity details
              </Link>
              <Link
                href="/get-started?step=finish"
                className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Continue as citizen for now
              </Link>
            </div>
          </div>
        ) : hasVerificationAttempt ? (
          <div className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-ink">This account does not match the profile strongly enough</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              Your current verified data does not line up with this public profile. The profile remains public and unclaimed, and claim continuation is intentionally hidden from unrelated authenticated users.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/get-started?step=verify&claimProfile=${profileId}`}
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Update verification details
              </Link>
              <Link
                href={candidate ? `/candidates/${profileId}` : `/officials/${profileId}`}
                className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Return to public profile
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-ink">Continue identity verification first</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              This claim flow is locked until your citizen account completes the voter-verification step. Once that is done, Direct Democracy can determine whether you match this public profile.
            </p>
            <Link
              href={`/get-started?step=verify&claimProfile=${profileId}`}
              className="mt-5 inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Continue identity verification
            </Link>
          </div>
        )}

        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-ink">How profile claiming works</h2>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
            <li>1. Start as a citizen account.</li>
            <li>2. Verify legal identity and voter registration data.</li>
            <li>3. Match that identity against public candidate or official records.</li>
            <li>4. Allow claim only when the match is strong enough, or send ambiguous cases to review.</li>
          </ul>
        </div>
      </div>
    );
  }

  if (candidate) {
    const match = await getClaimMatchForProfile(profileId, sessionUser, draft);

    return (
      <div className="py-8">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          {renderClaimBody({
            heading: `Claim ${candidate.name}'s profile`,
            profileLabel: candidate.profileType === "incumbentCandidate" ? "Incumbent candidate" : "Candidate",
            jurisdictionName: candidate.jurisdictionName,
            status: match.status,
          })}
        </section>
      </div>
    );
  }

  const official = await getOfficialById(profileId);

  if (official) {
    const match = await getClaimMatchForProfile(profileId, sessionUser, draft);

    return (
      <div className="py-8">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          {renderClaimBody({
            heading: `Claim ${official.name}'s profile`,
            profileLabel: official.officeTitle,
            jurisdictionName: official.jurisdictionName,
            status: match.status,
          })}
        </section>
      </div>
    );
  }

  notFound();
}
