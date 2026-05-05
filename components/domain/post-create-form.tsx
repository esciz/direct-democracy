import Link from "next/link";

import { IssuePickerField } from "@/components/domain/issue-picker-field";
import { PostContentTypeField } from "@/components/domain/post-content-type-field";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { createMockPost } from "@/lib/feed/actions";

type PostCreateFormProps = {
  roleLabel: string;
  jurisdictionName: string;
  defaultJurisdictionId?: string | null;
  isMediaUser?: boolean;
  error?: string;
  issueOptions?: string[];
  shareContext?: {
    entityType: string;
    entityId: string;
    title: string;
    href: string;
    summary?: string | null;
    issueTag?: string | null;
  } | null;
  attachmentPrefill?: {
    type: string;
    id: string;
    label: string;
    jurisdictionId?: string | null;
  } | null;
};

const attachmentOptions = [
  { value: "community", label: "Community / jurisdiction" },
  { value: "issue", label: "Issue / bill / ordinance / agency action / case" },
  { value: "official", label: "Official / candidate" },
  { value: "petition", label: "Petition / legislation" },
  { value: "election", label: "Election" },
  { value: "coalition", label: "Coalition / group / event" },
] as const;

const perspectiveTypeOptions = [
  { value: "perspective", label: "Civic Brief / Perspective" },
  { value: "official_update", label: "Official update" },
  { value: "candidate_statement", label: "Candidate statement" },
  { value: "media_summary", label: "Media summary" },
  { value: "coalition_update", label: "Coalition update" },
  { value: "petition_update", label: "Petition update" },
] as const;

export function PostCreateForm({
  roleLabel,
  jurisdictionName,
  defaultJurisdictionId = null,
  isMediaUser = false,
  error,
  issueOptions = [],
  shareContext = null,
  attachmentPrefill = null,
}: PostCreateFormProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {roleLabel}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {jurisdictionName}
        </span>
      </div>

      <form action={createMockPost} className="mt-6 space-y-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Where should this appear?</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Perspectives are always attached to a real civic context. Choose where this brief belongs before publishing.
          </p>
          {attachmentPrefill ? (
            <div className="mt-3 rounded-2xl border border-civic-200 bg-civic-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">This will appear on</p>
              <p className="mt-2 text-sm font-semibold text-ink">{attachmentPrefill.label}</p>
              <input type="hidden" name="attachmentType" value={attachmentPrefill.type} />
              <input type="hidden" name="attachmentId" value={attachmentPrefill.id} />
              <input type="hidden" name="attachmentLabel" value={attachmentPrefill.label} />
              <input type="hidden" name="attachmentJurisdictionId" value={attachmentPrefill.jurisdictionId ?? defaultJurisdictionId ?? ""} />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div>
                <label htmlFor="attachmentType" className="text-sm font-semibold text-ink">
                  Attach this to
                </label>
                <select
                  id="attachmentType"
                  name="attachmentType"
                  defaultValue=""
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                >
                  <option value="">Choose a destination</option>
                  {attachmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="attachmentLabel" className="text-sm font-semibold text-ink">
                  Destination name
                </label>
                <input
                  id="attachmentLabel"
                  name="attachmentLabel"
                  type="text"
                  placeholder="Carson City Community or AB 214 Housing Affordability"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                />
                <input type="hidden" name="attachmentJurisdictionId" value={defaultJurisdictionId ?? ""} />
              </div>
            </div>
          )}
          {error === "attachment" ? (
            <p className="mt-3 text-sm font-medium text-orange-700">Choose a destination so this perspective appears in a real civic context.</p>
          ) : null}
        </div>

        {shareContext ? (
          <div className="rounded-[1.5rem] border border-civic-200 bg-civic-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Post about this</p>
            <p className="mt-2 text-sm font-semibold text-ink">{shareContext.title}</p>
            {shareContext.summary ? <p className="mt-2 text-sm leading-6 text-slate-600">{shareContext.summary}</p> : null}
            <div className="mt-3">
              <Link href={shareContext.href} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                View original item
              </Link>
            </div>
            <input type="hidden" name="shareMode" value="post" />
            <input type="hidden" name="shareEntityType" value={shareContext.entityType} />
            <input type="hidden" name="shareEntityId" value={shareContext.entityId} />
            <input type="hidden" name="shareTitle" value={shareContext.title} />
            <input type="hidden" name="shareHref" value={shareContext.href} />
            <input type="hidden" name="shareSummary" value={shareContext.summary ?? ""} />
            <input type="hidden" name="shareIssueTag" value={shareContext.issueTag ?? ""} />
          </div>
        ) : null}
        <div>
          <label htmlFor="title" className="text-sm font-semibold text-ink">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            maxLength={120}
            placeholder="Share a district update"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          {error === "title" ? (
            <p className="mt-2 text-sm font-medium text-orange-700">Keep the title under 120 characters.</p>
          ) : null}
        </div>

        <PostContentTypeField isMediaUser={isMediaUser} />

        <div>
          <label htmlFor="perspectiveType" className="text-sm font-semibold text-ink">
            Civic brief type
          </label>
          <select
            id="perspectiveType"
            name="perspectiveType"
            defaultValue={isMediaUser ? "media_summary" : "perspective"}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          >
            {perspectiveTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <IssuePickerField
          name="issueTag"
          label="Related issue"
          options={issueOptions}
          placeholder="Select a shared issue"
          helpText="If this brief is tied to an issue, bill, ordinance, or case, link it here so it appears in the right issue context too."
          allowCustom={false}
          defaultValue={shareContext?.issueTag ?? ""}
        />

        <div>
          <label htmlFor="stance" className="text-sm font-semibold text-ink">
            Stance
          </label>
          <select
            id="stance"
            name="stance"
            defaultValue="explain"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          >
            <option value="explain">Explain / contextualize</option>
            <option value="support">Support</option>
            <option value="oppose">Oppose</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        <div>
          <label htmlFor="postType" className="text-sm font-semibold text-ink">
            Post type
          </label>
          <select
            id="postType"
            name="postType"
            defaultValue="TEXT"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          >
            <option value="TEXT">Text</option>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
          </select>
          <p className="mt-2 text-xs text-slate-500">Choose text, image, or video. Image posts can be memes with an optional caption. Video posts use a single video URL in v1.</p>
        </div>

        {isMediaUser ? (
          <div>
            <label htmlFor="promotedLabel" className="text-sm font-semibold text-ink">
              Distribution label
            </label>
            <select
              id="promotedLabel"
              name="promotedLabel"
              defaultValue=""
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
            >
              <option value="">Standard newsroom post</option>
              <option value="Promoted">Promoted</option>
              <option value="Sponsored">Sponsored</option>
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Use this only when the story has extra distribution or paid placement and needs a clear public label.
            </p>
          </div>
        ) : null}

        <div>
          <label htmlFor="mediaUrl" className="text-sm font-semibold text-ink">
            Image / video URL
          </label>
          <input
            id="mediaUrl"
            name="mediaUrl"
            type="url"
            placeholder="https://example.com/meme.png or a video link"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          {error === "mediaUrl" ? (
            <p className="mt-2 text-sm font-medium text-orange-700">Image and video posts need one valid media URL.</p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            Use one direct image URL for meme-style posts, or a video URL / YouTube link for video posts.
          </p>
        </div>

        <div>
          <label htmlFor="content" className="text-sm font-semibold text-ink">
            Caption or body
          </label>
          <textarea
            id="content"
            name="content"
            rows={8}
            placeholder="Add context, a caption, or a short explanation for this post or meme."
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          {error === "content" ? (
            <p className="mt-2 text-sm font-medium text-orange-700">Please enter at least 10 characters before publishing.</p>
          ) : null}
          {error === "contentType" ? (
            <p className="mt-2 text-sm font-medium text-orange-700">Please choose a valid content type.</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <FormSubmitButton
            idleLabel="Publish perspective"
            pendingLabel="Publishing..."
            className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
          <Link
            href="/posts"
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to perspectives
          </Link>
        </div>
      </form>
    </section>
  );
}
