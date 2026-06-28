import Link from "next/link";
import { redirect } from "next/navigation";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { requestGuidedVoterPortalVerificationAction, requestResidencyVerificationAction } from "@/app/account/verification/actions";
import { AccountParticipationStatusCard } from "@/components/domain/account-participation-status-card";
import { getAccountParticipationStatus } from "@/lib/civic-signals/account-participation-status";
import { readIdentityStore } from "@/lib/identity/storage";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

type AccountVerificationPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

type VoterFileProviderAudit = {
  totals?: {
    providers?: number;
    recordsIndexed?: number;
    activeRecords?: number;
    countiesIndexed?: number;
  };
  providers?: Array<{
    county: string;
    dateOfRecord: string;
    activeRecords: number;
  }>;
};

function readVoterFileProviderAudit(): VoterFileProviderAudit | null {
  const filePath = path.join(process.cwd(), "data", "generated", "voter-file-provider-audit.json");
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as VoterFileProviderAudit;
}

function statusClass(status: string) {
  switch (status) {
    case "verified":
    case "matched":
      return "border-civic-200 bg-civic-50 text-civic-900";
    case "pending":
    case "pending_manual_review":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "rejected":
    case "revoked":
      return "border-rose-200 bg-rose-50 text-rose-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function claimStatusCopy(claim: { claimType: string; status: string; rejectionReason: string | null }) {
  if (claim.status === "matched" || claim.status === "verified") {
    return claim.claimType === "voter"
      ? "Verified voter status is active. Your source-backed votes can count as verified voter signals when privacy thresholds are met."
      : "Verified residency status is active for stakeholder analytics when privacy thresholds are met.";
  }
  if (claim.status === "pending" || claim.status === "pending_manual_review") {
    return "This request is waiting for authorized review. It is not published automatically.";
  }
  if (claim.status === "needs_information") {
    return claim.rejectionReason || "A reviewer needs more information before this request can continue.";
  }
  if (claim.status === "rejected") {
    return claim.rejectionReason || "This request was not approved. You can submit a corrected request if the information has changed.";
  }
  return "This claim is recorded privately for account verification history.";
}

function claimDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AccountVerificationPage({ searchParams }: AccountVerificationPageProps) {
  const [params, user] = await Promise.all([searchParams, getCurrentSessionUser()]);
  if (!user) redirect("/auth");

  const store = readIdentityStore();
  const claims = store.verificationClaims.filter((claim) => claim.userId === user.id);
  const residencyClaims = claims.filter((claim) => claim.claimType === "residency");
  const voterClaims = claims.filter((claim) => claim.claimType === "voter");
  const hasPendingResidency = residencyClaims.some((claim) => claim.status === "pending" || claim.status === "pending_manual_review");
  const hasVerifiedResidency = residencyClaims.some((claim) => claim.status === "verified" && (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now()));
  const hasPendingVoter = voterClaims.some((claim) => claim.status === "pending" || claim.status === "pending_manual_review");
  const hasVerifiedVoter = voterClaims.some((claim) => claim.status === "matched" && (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now()));
  const participationStatus = await getAccountParticipationStatus(user, { signedIn: true });
  const voterFileProvider = readVoterFileProviderAudit();

  return (
    <main className="mx-auto max-w-5xl space-y-6 py-8">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Account verification</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Verified stakeholder eligibility</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Residency review is the privacy-preserving bridge from “can vote” to “counts in verified stakeholder analytics.”
              Direct Democracy does not publish submissions automatically and does not store raw street-address evidence in this local identity record.
            </p>
          </div>
          <Link href="/profile" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
            Back to profile
          </Link>
        </div>
      </section>

      {params?.status === "submitted" || params?.status === "residency-submitted" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your residency review request was submitted successfully. It now appears in your private claim history and in the admin review queue.
        </section>
      ) : null}
      {params?.status === "voter-submitted" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your guided voter portal verification was submitted successfully. Direct Democracy prepared a structured review packet from your official-source fields so an authorized reviewer can focus on exceptions instead of retyping the whole lookup.
        </section>
      ) : null}
      {params?.status === "voter-auto-matched" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your voter registration matched an imported official voter-file record. Your account now has a verified voter claim.
        </section>
      ) : null}
      {params?.status === "missing" || params?.status === "residency-missing" ? (
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-card">
          Add a residency area and accept the attestation before submitting the residency review.
        </section>
      ) : null}
      {params?.status === "voter-missing" ? (
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-card">
          Add the county/jurisdiction, describe the official portal result, and accept the attestation before submitting.
        </section>
      ) : null}

      <AccountParticipationStatusCard status={participationStatus} />

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div id="voter-review" className="scroll-mt-28 rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Guided voter verification</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Use the official Nevada voter lookup</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Direct Democracy first checks imported official voter-file records. If your county is not indexed yet, use the official Nevada voter search as the source step and submit a review-ready claim using the County Voter ID and Election Precinct shown by the lookup.
              </p>
            </div>
            <a
              href="https://www.nvsos.gov/votersearch/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open official lookup
            </a>
          </div>

          {hasVerifiedVoter ? (
            <div className="mt-5 rounded-3xl border border-civic-200 bg-civic-50 p-5 text-sm leading-6 text-civic-950">
              You already have an active verified voter claim. Your source-backed votes can count as verified voter signals when privacy thresholds are met.
            </div>
          ) : hasPendingVoter ? (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              A guided voter portal request is pending review. Once approved, your account becomes verified voter eligible without changing vote weight.
            </div>
          ) : (
            <form action={requestGuidedVoterPortalVerificationAction} className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 lg:col-span-2">
                {voterFileProvider?.totals?.activeRecords ? (
                  <>
                    Automated matching is currently available for {voterFileProvider.providers?.map((provider) => provider.county).join(", ") || "indexed counties"} using {voterFileProvider.totals.activeRecords.toLocaleString()} active official records. Other Nevada counties continue through assisted guided review: the system prepares the review packet, but a human must confirm before approval.
                  </>
                ) : (
                  <>Automated voter-file matching is not indexed yet. This form will submit an assisted official-portal review request.</>
                )}
              </div>
              <label className="block text-sm font-semibold text-slate-800">
                Registered first name
                <input
                  name="registeredFirstName"
                  required
                  placeholder="Example: Eli"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-civic-500"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Registered last name
                <input
                  name="registeredLastName"
                  required
                  placeholder="Example: Scislowicz"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-civic-500"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                County or jurisdiction shown by the lookup
                <input
                  name="countyOrJurisdiction"
                  required
                  placeholder="Example: Carson City or Washoe County"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-civic-500"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                County Voter ID
                <input
                  name="countyVoterId"
                  required
                  inputMode="numeric"
                  placeholder="Example: 5060084"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-civic-500"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Election Precinct
                <input
                  name="electionPrecinct"
                  required
                  placeholder="Example: 309.1"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-civic-500"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Voting status shown by official lookup
                <select
                  name="portalResultSummary"
                  required
                  defaultValue=""
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-civic-500"
                >
                  <option value="" disabled>Select the status you saw</option>
                  <option value="Official Nevada voter lookup shows voting status active.">Active</option>
                  <option value="Official Nevada voter lookup shows voting status inactive.">Inactive</option>
                  <option value="Official Nevada voter lookup shows voting status canceled or cancelled.">Canceled</option>
                  <option value="Official Nevada voter lookup shows a registered voter record, but the status needs reviewer confirmation.">Status shown, needs reviewer confirmation</option>
                  <option value="Official Nevada voter lookup did not show a clear voter-registration status.">No clear status shown</option>
                </select>
                <p className="mt-2 text-xs font-normal leading-5 text-slate-500">
                  Choose the status exactly as the official lookup presents it. If unsure, choose "needs reviewer confirmation."
                </p>
              </label>
              <label className="flex gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 lg:col-span-2">
                <input name="attestationAccepted" type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" required />
                <span>I used the official Nevada voter lookup and attest that the submitted summary reflects my own voter-registration result. I understand this enters review and is not published automatically.</span>
              </label>
              <button type="submit" className="w-fit rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Submit guided voter review
              </button>
            </form>
          )}
        </div>

        <div id="residency-review" className="scroll-mt-28 rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Residency request</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Request manual review</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Submit a Nevada residency review request for this account. This does not verify voter registration, does not publish your information, and does not change vote weight.
          </p>

          {hasVerifiedResidency ? (
            <div className="mt-5 rounded-3xl border border-civic-200 bg-civic-50 p-5 text-sm leading-6 text-civic-950">
              You already have an active verified residency claim. Voter-provider matching can be added later without changing your vote weight.
            </div>
          ) : hasPendingResidency ? (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              A residency request is already pending manual review. You can submit a new request only after the current one is reviewed or expires.
            </div>
          ) : (
            <form action={requestResidencyVerificationAction} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-slate-800">
                Nevada residency area
                <input
                  name="residencyArea"
                  required
                  placeholder="Example: Carson City, Washoe County, Henderson"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-civic-500"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Community ID or slug, optional
                <input
                  name="communityId"
                  placeholder="Example: carson-city"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-civic-500"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                Evidence note, optional
                <textarea
                  name="evidenceDescription"
                  rows={4}
                  placeholder="Describe the evidence an admin should review. Do not paste full SSNs, passwords, or private account numbers."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-civic-500"
                />
              </label>
              <label className="flex gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <input name="attestationAccepted" type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" required />
                <span>I attest that this request is for my current Nevada residency and understand it requires manual review before affecting verified stakeholder analytics.</span>
              </label>
              <button type="submit" className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Submit residency review
              </button>
            </form>
          )}
        </div>

        <div id="claim-history" className="scroll-mt-28 rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Claim history</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Private verification status</h2>
          <div className="mt-5 space-y-3">
            {[...residencyClaims, ...voterClaims].length ? (
              [...residencyClaims, ...voterClaims].map((claim) => (
                <div key={claim.id} className={`rounded-3xl border p-4 text-sm ${statusClass(claim.status)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold capitalize">{claim.claimType} claim</p>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold">{claim.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-2 text-xs opacity-80">Method: {claim.method.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs opacity-80">Evidence: {claim.evidenceDisposition.replaceAll("_", " ")}</p>
                  <p className="mt-2 text-xs leading-5 opacity-90">{claimStatusCopy(claim)}</p>
                  {claim.reviewContext ? (
                    <div className="mt-3 grid gap-2 text-xs opacity-90 sm:grid-cols-3">
                      <p className="rounded-2xl bg-white/60 p-2">County: {claim.reviewContext.countyOrJurisdiction ?? "not provided"}</p>
                      <p className="rounded-2xl bg-white/60 p-2">Precinct: {claim.reviewContext.electionPrecinct ?? "not provided"}</p>
                      <p className="rounded-2xl bg-white/60 p-2">Voter ID ending: {claim.reviewContext.countyVoterIdLast4 ?? "not provided"}</p>
                    </div>
                  ) : null}
                  {claim.verifiedAt ? <p className="mt-1 text-xs opacity-80">Verified: {claimDate(claim.verifiedAt)}</p> : null}
                  {claim.expiresAt ? <p className="mt-1 text-xs opacity-80">Expires: {new Date(claim.expiresAt).toLocaleDateString()}</p> : null}
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                No residency or voter verification claims have been submitted for this account yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
