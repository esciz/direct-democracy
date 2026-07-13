import Link from "next/link";
import { notFound } from "next/navigation";

import { CommunityEventCard } from "@/components/domain/community-event-card";
import { DebateCard } from "@/components/domain/debate-card";
import { ActionLabel, ThumbsDownIcon, ThumbsUpIcon } from "@/components/ui/action-icons";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { PageIntro } from "@/components/ui/page-intro";
import { SectionHeading } from "@/components/ui/section-heading";
import { getOrganizationTypeLabel } from "@/lib/organizations/presentation";
import {
  approveOrganizationMembership,
  createOrganizationAnnouncement,
  createOrganizationPlatformItem,
  removeOrganizationEndorsement,
  requestOrganizationMembership,
  saveOrganizationEndorsement,
  voteOnOrganizationPlatformItem,
} from "@/lib/organizations/actions";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getGovernmentBodyById, getOrganizationById, getOrganizationCampaignOptions } from "@/lib/organizations/store";
import type { GovernmentBodyDetail } from "@/lib/organizations/store";

type OrganizationDetailPageProps = {
  params: Promise<{
    orgId: string;
  }>;
  searchParams?: Promise<{
    org?: string;
    orgError?: string;
  }>;
};

function formatBodyDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function GovernmentBodyDetailPage({ body }: { body: GovernmentBodyDetail }) {
  const sourceLinks = [
    body.website ? { label: "Official website", href: body.website } : null,
    body.meetingIndexUrl ? { label: "Meeting index", href: body.meetingIndexUrl } : null,
    body.sourceUrl && body.sourceUrl !== body.meetingIndexUrl ? { label: "Source", href: body.sourceUrl } : null,
  ].filter((entry): entry is { label: string; href: string } => Boolean(entry));

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Government body"
        title={body.name}
        description={body.description}
        meta={
          <>
            <span className="rounded-full bg-cyan-500/12 px-3 py-1 text-xs font-semibold text-cyan-100">Source-backed</span>
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-slate-200">{body.jurisdictionName}</span>
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-slate-200">{body.level}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-3">
            {body.sourceUrl ? (
              <Link href={body.sourceUrl} className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5">
                Open source
              </Link>
            ) : null}
            {body.communityId ? (
              <Link href={`/community/${body.communityId}`} className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold transition hover:border-cyan-300/30 hover:text-white">
                Open community
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <section className="dd-panel-muted rounded-[1.75rem] p-6">
          <SectionHeading
            eyebrow="Public record"
            title="What this page represents"
            description="This is a source-backed government body record from the generated Nevada meeting-source layer. It is not a member-run civic organization."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Jurisdiction</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{body.jurisdictionName}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Coverage level</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{body.level}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Community match</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{body.communityName ?? "Statewide / pending match"}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Status</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{body.active ? "Active source" : "Inactive / review needed"}</p>
            </div>
          </div>
        </section>

        <section className="dd-panel-muted rounded-[1.75rem] p-6">
          <SectionHeading
            eyebrow="Source trail"
            title="Where this came from"
            description="Source links stay visible so residents can inspect the original public record."
          />
          <div className="mt-5 grid gap-3">
            {sourceLinks.length ? (
              sourceLinks.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/25 hover:text-white"
                >
                  {link.label}
                </Link>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">No public source URL is currently attached to this body.</div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
          <SectionHeading
            eyebrow="Meetings"
            title="Meeting records"
            description="Meeting, agenda, packet, and minutes records appear in Events and community dashboards when imported."
          />
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/explore?browseCategory=events${body.communityId ? `&communityId=${body.communityId}` : ""}`} className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
              Browse related events
            </Link>
            {body.meetingIndexUrl ? (
              <Link href={body.meetingIndexUrl} className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
                Official meeting source
              </Link>
            ) : null}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
          <SectionHeading
            eyebrow="Data quality"
            title="Coverage status"
            description="This body is available because it exists in the generated public-meeting body index."
          />
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Source type</dt>
              <dd className="font-semibold text-slate-100">{body.scraperType ?? "manual source"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Seed source</dt>
              <dd className="font-semibold text-slate-100">{body.seedSourceId ?? "not labeled"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Updated</dt>
              <dd className="font-semibold text-slate-100">{formatBodyDate(body.updatedAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
          <SectionHeading
            eyebrow="Limited data"
            title="No member workflow"
            description="Government bodies do not support joining, endorsements, or member petitions. Those tools remain for citizen-created civic organizations."
          />
          <p className="mt-5 text-sm leading-6 text-slate-400">
            This page focuses on source transparency and civic navigation. Related decisions, votes, projects, and spending surface through community dashboards as source records are ingested.
          </p>
        </section>
      </section>
    </div>
  );
}

export default async function OrganizationDetailPage({ params, searchParams }: OrganizationDetailPageProps) {
  const { orgId } = await params;
  const user = await getCurrentUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [organization, governmentBody] = await Promise.all([
    getOrganizationById(orgId, user),
    getGovernmentBodyById(orgId),
  ]);

  if (!organization) {
    if (governmentBody) {
      return <GovernmentBodyDetailPage body={governmentBody} />;
    }

    notFound();
  }

  const campaignOptions = await getOrganizationCampaignOptions(orgId);
  const pendingMemberships = organization.memberships.filter((entry) => entry.state === "pending");
  const returnPath = `/organizations/${organization.id}`;
  const viewerIsMember = organization.viewerMembershipState === "approved";
  const viewerPending = organization.viewerMembershipState === "pending";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow={getOrganizationTypeLabel(organization.organizationType)}
        title={organization.name}
        description={organization.description}
        meta={
          <>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {organization.memberCount} members
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {organization.jurisdictionName}
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-3">
            {!organization.viewerMembershipState ? (
              <form action={requestOrganizationMembership}>
                <input type="hidden" name="organizationId" value={organization.id} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <FormSubmitButton
                  idleLabel="Request to join"
                  pendingLabel="Sending..."
                  className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
                />
              </form>
            ) : null}
            {organization.viewerMembershipState === "pending" ? (
              <span className="rounded-full border border-amber-300/18 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
                Membership pending
              </span>
            ) : null}
            {organization.canManage ? (
              <Link
                href={`/events/create?communityId=${organization.communityId}&organizationId=${organization.id}`}
                className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold transition hover:border-cyan-300/30 hover:text-white"
              >
                Create event
              </Link>
            ) : null}
            {organization.canManage ? (
              <Link
                href={`/debates/new?issueId=&organizationId=${organization.id}`}
                className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold transition hover:border-cyan-300/30 hover:text-white"
              >
                Start debate
              </Link>
            ) : null}
            {organization.canManage ? (
              <Link
                href={`/petitions/create?organizationId=${organization.id}`}
                className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold transition hover:border-cyan-300/30 hover:text-white"
              >
                Create petition
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-500/10 p-5 shadow-[0_24px_55px_-34px_rgba(8,145,178,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Take action with this organization</p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {organization.canManage ? "Manage this organization" : viewerIsMember ? "You are a member" : viewerPending ? "Your join request is pending" : "Join before participating"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-cyan-50/85">
              {organization.canManage
                ? "Create events, debates, petitions, announcements, and platform items from this page."
                : viewerIsMember
                  ? "Members can vote on platform items and participate in organization action."
                  : viewerPending
                    ? "An organization admin needs to approve your membership before you can vote or help manage action."
                    : "Request membership to participate in this group’s platform votes and organized civic work."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!organization.viewerMembershipState ? (
              <form action={requestOrganizationMembership}>
                <input type="hidden" name="organizationId" value={organization.id} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <FormSubmitButton
                  idleLabel="Request to join"
                  pendingLabel="Sending..."
                  className="rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                />
              </form>
            ) : null}
            {organization.canManage ? (
              <>
                <Link href={`/events/create?communityId=${organization.communityId}&organizationId=${organization.id}`} className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
                  Create event
                </Link>
                <Link href={`/petitions/create?organizationId=${organization.id}`} className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
                  Create petition
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {resolvedSearchParams?.org ? (
        <section className="rounded-[1.75rem] border border-cyan-300/16 bg-cyan-500/10 p-5 text-sm text-cyan-100 shadow-card">
          {resolvedSearchParams.org === "created" && "Organization created."}
          {resolvedSearchParams.org === "approved" && "Organization request approved and published."}
          {resolvedSearchParams.org === "membership-requested" && "Your join request was sent to the org admins."}
          {resolvedSearchParams.org === "membership-approved" && "Membership approved."}
          {resolvedSearchParams.org === "membership-exists" && "You already have a membership request or active membership here."}
          {resolvedSearchParams.org === "announcement-sent" && "Announcement sent to members."}
          {resolvedSearchParams.org === "platform-saved" && "Platform item saved."}
          {resolvedSearchParams.org === "vote-saved" && "Your member vote was recorded."}
          {resolvedSearchParams.org === "endorsement-saved" && "Organization endorsement saved."}
          {resolvedSearchParams.org === "endorsement-removed" && "Organization endorsement removed."}
        </section>
      ) : null}
      {resolvedSearchParams?.orgError ? (
        <section className="rounded-[1.75rem] border border-amber-300/16 bg-amber-500/10 p-5 text-sm text-amber-100 shadow-card">
          {resolvedSearchParams.orgError === "manage" && "Only organization founders or admins can do that."}
          {resolvedSearchParams.orgError === "announcement" && "Add a short title and a clearer announcement body."}
          {resolvedSearchParams.orgError === "platform" && "Platform items need a title, description, issue tag, and valid status."}
          {resolvedSearchParams.orgError === "endorsement" && "Pick a valid candidate campaign to endorse."}
          {resolvedSearchParams.orgError === "vote" && "Only approved members can vote on platform items."}
          {resolvedSearchParams.orgError === "membership" && "That membership request could not be found."}
          {resolvedSearchParams.orgError === "approval" && "You do not have permission to approve that request."}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <section className="dd-panel-muted rounded-[1.75rem] p-6">
          <SectionHeading
            eyebrow="Profile"
            title="Organization profile"
            description="Structured org profiles combine membership, issue focus, platform items, events, debates, petitions, endorsements, and announcements."
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Founder</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{organization.founderName}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Admins</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{organization.adminNames.join(" · ")}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {organization.issueTags.map((tag) => (
              <span key={tag} className="rounded-full border border-amber-300/18 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="dd-panel-muted rounded-[1.75rem] p-6">
          <SectionHeading
            eyebrow="Announcements"
            title="Member announcements"
            description="Announcements are one-to-many broadcasts for members, not chat threads."
          />
          {organization.canManage ? (
            <form action={createOrganizationAnnouncement} className="mt-5 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <input type="hidden" name="organizationId" value={organization.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <input name="title" placeholder="Announcement title" className="dd-input rounded-2xl px-4 py-3 text-sm outline-none focus:border-cyan-300/30" />
              <textarea name="body" rows={4} placeholder="Share a concise announcement with members." className="dd-input rounded-3xl px-4 py-3 text-sm outline-none focus:border-cyan-300/30" />
              <FormSubmitButton idleLabel="Send announcement" pendingLabel="Sending..." className="dd-button-primary w-fit rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5" />
            </form>
          ) : null}
          <div className="mt-5 grid gap-3">
            {organization.announcements.length ? (
              organization.announcements.map((announcement) => (
                <article key={announcement.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-semibold text-slate-100">{announcement.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{announcement.body}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {announcement.createdByUserName} · {new Date(announcement.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">No announcements yet.</div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Platform"
              title="Platform and action items"
              description="Organizations can define platform items, run internal member voting, and highlight adopted positions."
            />
          </div>
          {organization.canManage ? (
            <form action={createOrganizationPlatformItem} className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-4">
              <input type="hidden" name="organizationId" value={organization.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <input name="title" placeholder="Platform item title" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
              <textarea name="description" rows={4} placeholder="Describe the policy, platform point, or action item." className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="issueTag" placeholder="Issue tag" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
                <select name="status" defaultValue="active" className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="adopted">Adopted</option>
                </select>
              </div>
              <FormSubmitButton idleLabel="Save platform item" pendingLabel="Saving..." className="w-fit rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700" />
            </form>
          ) : null}

          <div className="mt-5 grid gap-4">
            {organization.platformItems.length ? (
              organization.platformItems.map((item) => (
                <article key={item.id} className="rounded-3xl bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{item.issueTag}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {item.status}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <span>{item.supportCount} support</span>
                    <span>{item.opposeCount} oppose</span>
                  </div>
                  {organization.viewerMembershipRole ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <form action={voteOnOrganizationPlatformItem}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input type="hidden" name="platformItemId" value={item.id} />
                        <input type="hidden" name="choice" value="support" />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <FormSubmitButton
                          idleLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>{item.viewerVote === "support" ? "Supporting" : "Support"}</ActionLabel>}
                          pendingLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
                          className={item.viewerVote === "support" ? "rounded-full bg-civic-500 px-4 py-2 text-sm font-semibold text-white" : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"}
                        />
                      </form>
                      <form action={voteOnOrganizationPlatformItem}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input type="hidden" name="platformItemId" value={item.id} />
                        <input type="hidden" name="choice" value="oppose" />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <FormSubmitButton
                          idleLabel={<ActionLabel icon={<ThumbsDownIcon className="h-4 w-4" />}>{item.viewerVote === "oppose" ? "Opposing" : "Oppose"}</ActionLabel>}
                          pendingLabel={<ActionLabel icon={<ThumbsDownIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
                          className={item.viewerVote === "oppose" ? "rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white" : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-700"}
                        />
                      </form>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No platform items yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Membership"
            title="Members and approvals"
            description="Membership stays structured. Users request to join and admins approve."
          />
          <div className="mt-5 grid gap-3">
            {organization.memberships.filter((entry) => entry.state === "approved").map((membership) => (
              <article key={membership.id} className="rounded-3xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{membership.userName}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{membership.role}</span>
                </div>
              </article>
            ))}
          </div>
          {organization.canManage && pendingMemberships.length ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold text-ink">Pending join requests</p>
              {pendingMemberships.map((membership) => (
                <article key={membership.id} className="rounded-3xl bg-orange-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{membership.userName}</p>
                    <form action={approveOrganizationMembership}>
                      <input type="hidden" name="membershipId" value={membership.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <button type="submit" className="rounded-full bg-civic-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-civic-700">
                        Approve
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Endorsements"
            title="Candidate endorsements"
            description="Organization endorsements stay clearly labeled so the public can distinguish group positions from individual citizen views."
          />
          {organization.canManage ? (
            <form action={saveOrganizationEndorsement} className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-4">
              <input type="hidden" name="organizationId" value={organization.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <select name="candidateCampaignId" defaultValue="" className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500">
                <option value="">Choose candidate campaign</option>
                {campaignOptions.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.candidateName} · {campaign.officeSought}
                  </option>
                ))}
              </select>
              <textarea name="statement" rows={3} placeholder="Optional endorsement note" className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
              <FormSubmitButton idleLabel="Save endorsement" pendingLabel="Saving..." className="w-fit rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700" />
            </form>
          ) : null}
          <div className="mt-5 grid gap-3">
            {organization.endorsements.length ? (
              organization.endorsements.map((endorsement) => (
                <article key={endorsement.id} className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{endorsement.candidateName}</p>
                      <p className="mt-1 text-sm text-slate-600">{endorsement.officeSought} · {endorsement.electionTitle}</p>
                    </div>
                    <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                      Organization Endorsement
                    </span>
                  </div>
                  {endorsement.statement ? <p className="mt-3 text-sm leading-6 text-slate-600">{endorsement.statement}</p> : null}
                  {organization.canManage ? (
                    <form action={removeOrganizationEndorsement} className="mt-3">
                      <input type="hidden" name="endorsementId" value={endorsement.id} />
                      <input type="hidden" name="returnPath" value={returnPath} />
                      <FormSubmitButton idleLabel="Remove endorsement" pendingLabel="Removing..." className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700" />
                    </form>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">No endorsements yet.</div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading
            eyebrow="Petitions"
            title="Organization-linked petitions"
            description="Organizations can act collectively around petitions while keeping the group layer separate from donations or PAC activity."
          />
          <div className="mt-5 grid gap-3">
            {organization.relatedPetitions.length ? (
              organization.relatedPetitions.map((petition) => (
                <article key={petition.id} className="rounded-3xl bg-slate-50 p-4">
                  <Link href={`/petitions/${petition.id}`} className="text-sm font-semibold text-ink hover:text-civic-700">
                    {petition.title}
                  </Link>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{petition.summary}</p>
                </article>
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">No organization petitions linked yet.</div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading eyebrow="Events" title="Organization events" description="Organizations can host events and appear across community and Explore surfaces." />
          <div className="mt-5 grid gap-4">
            {organization.relatedEvents.length ? (
              organization.relatedEvents.map((event) => (
                <CommunityEventCard key={event.id} event={event} returnPath={returnPath} />
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">No organization events linked yet.</div>
            )}
          </div>
        </section>
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <SectionHeading eyebrow="Debates" title="Organization debates" description="Organizations can launch issue-based debates through the existing structured debate flow." />
          <div className="mt-5 grid gap-4">
            {organization.relatedDebates.length ? (
              organization.relatedDebates.map((debate) => <DebateCard key={debate.id} debate={debate} />)
            ) : (
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">No organization debates linked yet.</div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
