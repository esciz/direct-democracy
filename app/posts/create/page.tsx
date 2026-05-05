import Link from "next/link";
import { redirect } from "next/navigation";

import { PostCreateForm } from "@/components/domain/post-create-form";
import { canUserCreatePublicPost } from "@/lib/server/auth-guards";
import { getRoleLabel } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getIssuePickerOptions } from "@/lib/server/issues";

type CreatePostPageProps = {
  searchParams?: Promise<{
    error?: string;
    shareEntityType?: string;
    shareEntityId?: string;
    shareTitle?: string;
    shareHref?: string;
    shareSummary?: string;
    shareIssueTag?: string;
  }>;
};

export default async function CreatePostPage({ searchParams }: CreatePostPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;

  if (!(await canUserCreatePublicPost(user))) {
    redirect("/posts?denied=create-post");
  }

  const issueOptions = await getIssuePickerOptions(user);
  const shareContext =
    params?.shareEntityType && params?.shareEntityId && params?.shareTitle && params?.shareHref
      ? {
          entityType: params.shareEntityType,
          entityId: params.shareEntityId,
          title: params.shareTitle,
          href: params.shareHref,
          summary: params.shareSummary ?? null,
          issueTag: params.shareIssueTag ?? null,
        }
      : null;
  const attachmentPrefill = shareContext
    ? shareContext.entityType === "officialProfile"
      ? { type: "official", id: shareContext.entityId, label: shareContext.title, jurisdictionId: user.primaryCommunityId ?? null }
      : shareContext.entityType === "candidateProfile"
        ? { type: "candidate", id: shareContext.entityId, label: shareContext.title, jurisdictionId: user.primaryCommunityId ?? null }
        : shareContext.entityType === "organization"
          ? { type: "coalition", id: shareContext.entityId, label: shareContext.title, jurisdictionId: user.primaryCommunityId ?? null }
          : shareContext.entityType === "petition"
            ? { type: "petition", id: shareContext.entityId, label: shareContext.title, jurisdictionId: user.primaryCommunityId ?? null }
            : shareContext.entityType === "election"
              ? { type: "election", id: shareContext.entityId, label: shareContext.title, jurisdictionId: user.primaryCommunityId ?? null }
              : shareContext.entityType === "case"
                ? { type: "case", id: shareContext.entityId, label: shareContext.title, jurisdictionId: user.primaryCommunityId ?? null }
                : shareContext.entityType === "event"
                  ? { type: "event", id: shareContext.entityId, label: shareContext.title, jurisdictionId: user.primaryCommunityId ?? null }
                  : shareContext.issueTag
                    ? { type: "issue", id: shareContext.issueTag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), label: shareContext.issueTag, jurisdictionId: user.primaryCommunityId ?? null }
                    : null
    : null;

  return (
    <div className="space-y-6 py-8">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Civic Briefs</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Create a perspective</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          {user.role === "media"
            ? "Media accounts publish contextual summaries tied to a real issue, election, community, or profile page, with visible truth and bias context."
            : "Perspectives belong to a specific community, issue, profile, election, or coalition page. They do not publish into a generic standalone feed."}
        </p>
        <div className="mt-4">
          <Link href="/polls/create" className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            Need a structured question instead? Start a poll.
          </Link>
        </div>
      </section>

      <PostCreateForm
        roleLabel={getRoleLabel(user.role)}
        jurisdictionName={user.jurisdictionName}
        defaultJurisdictionId={user.primaryCommunityId ?? null}
        isMediaUser={user.role === "media"}
        error={params?.error}
        issueOptions={issueOptions}
        shareContext={shareContext}
        attachmentPrefill={attachmentPrefill}
      />
    </div>
  );
}
