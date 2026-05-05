import Link from "next/link";

import { IssuePickerField } from "@/components/domain/issue-picker-field";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { createCommunityEvent, createEventProposal } from "@/lib/community/event-actions";
import type { CommunityEventType, CommunitySummary, OrganizationSummary, UserRole } from "@/types/domain";

type CommunityEventFormProps = {
  community: CommunitySummary;
  roleLabel: string;
  userRole: UserRole;
  directTypes: CommunityEventType[];
  proposalTypes: CommunityEventType[];
  error?: string;
  returnPath: string;
  organization?: Pick<OrganizationSummary, "id" | "name" | "organizationType"> | null;
  issueOptions?: string[];
};

const EVENT_TYPE_OPTIONS = [
  { value: "civicMeeting", label: "Civic Meeting" },
  { value: "publicHearing", label: "Public Hearing" },
  { value: "demonstration", label: "Demonstration" },
  { value: "rally", label: "Rally" },
  { value: "communityEvent", label: "Community Event" },
  { value: "culturalSocialEvent", label: "Cultural / Social Event" },
].reduce<Record<string, string>>((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

export function CommunityEventForm({
  community,
  roleLabel,
  userRole,
  directTypes,
  proposalTypes,
  error,
  returnPath,
  organization,
  issueOptions = [],
}: CommunityEventFormProps) {
  const directOptions = directTypes.map((value) => ({ value, label: EVENT_TYPE_OPTIONS[value] }));
  const proposalOptions = proposalTypes.map((value) => ({ value, label: EVENT_TYPE_OPTIONS[value] }));
  const isCitizen = userRole === "citizen";

  return (
    <section className="space-y-6 rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {roleLabel}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {community.name}
        </span>
        {organization ? (
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            {organization.organizationType === "campus_org" ? "Campus org" : "Coalition"} · {organization.name}
          </span>
        ) : null}
        {isCitizen ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            Citizen limits active
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          {error === "details" && "Add a clearer title, description, and purpose so people understand what the event is for."}
          {error === "location" && "In-person events need a location."}
          {error === "meetingUrl" && "Virtual events need a meeting link."}
          {error === "startsAt" && "Please choose a valid date and time."}
          {error === "leadTime" && "Events need more lead time before they can go live."}
          {error === "duplicate" && "A very similar event or proposal already exists around that time."}
          {error === "limit" && "Citizen direct creation is limited to 2 upcoming events at a time."}
          {error === "proposalLimit" && "You already have several open event proposals. Please wait for one to advance first."}
          {error === "permissions" && "Your role can only directly create community or cultural events."}
          {error === "proposalPermissions" && "That event type cannot be proposed from this account."}
          {error === "proposalApproval" && "Only trusted citizens can approve civic event proposals."}
          {error === "proposalMissing" && "That proposal is no longer available."}
          {error === "type" && "Please choose one of the supported event types."}
          {error === "format" && "Please choose whether the event is virtual or in person."}
          {error === "community" && "That community could not be found."}
          {error === "organization" && "That organization could not be used for this event."}
          {error === "fields" && "Some required event fields were missing. Please try again."}
        </div>
      ) : null}

      <form action={createCommunityEvent} className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
        <input type="hidden" name="communityId" value={community.id} />
        <input type="hidden" name="returnPath" value={returnPath} />
        {organization ? <input type="hidden" name="organizationId" value={organization.id} /> : null}
        <div>
          <p className="text-lg font-semibold text-ink">{isCitizen ? "Create Community or Cultural Event" : "Create Event"}</p>
          <p className="mt-2 text-sm text-slate-600">
            {organization
              ? `This event will be published under ${organization.name}.`
              : isCitizen
              ? "Citizens can directly create lower-risk community and cultural events."
              : "Trusted citizens, candidates, and officials can directly publish all supported event types."}
          </p>
        </div>

        <div>
          <label htmlFor="title" className="text-sm font-semibold text-ink">Event title</label>
          <input id="title" name="title" type="text" placeholder="Neighborhood cleanup and community lunch" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
        </div>

        <div>
          <label htmlFor="description" className="text-sm font-semibold text-ink">Description</label>
          <textarea id="description" name="description" rows={4} placeholder="Tell people what the event is, who it is for, and what to expect." className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
        </div>

        <div>
          <label htmlFor="purpose" className="text-sm font-semibold text-ink">Purpose</label>
          <textarea id="purpose" name="purpose" rows={3} placeholder="State the specific purpose or public value of gathering." className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <IssuePickerField
            name="issueLabel"
            label="Linked issue"
            options={issueOptions}
            placeholder="Select a shared issue"
            helpText="Events link into the shared issue taxonomy so related activity rolls into one topic hub."
            allowCustom={false}
          />
          <div>
            <label htmlFor="startsAt" className="text-sm font-semibold text-ink">Date and time</label>
            <input id="startsAt" name="startsAt" type="datetime-local" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="eventType" className="text-sm font-semibold text-ink">Event type</label>
            <select id="eventType" name="eventType" defaultValue={directOptions[0]?.value ?? "communityEvent"} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500">
              {directOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="format" className="text-sm font-semibold text-ink">Format</label>
            <select id="format" name="format" defaultValue="inPerson" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500">
              <option value="inPerson">In person</option>
              <option value="virtual">Virtual</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="locationLabel" className="text-sm font-semibold text-ink">Location</label>
            <input id="locationLabel" name="locationLabel" type="text" placeholder="Community center, library room, downtown plaza" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
          </div>
          <div>
            <label htmlFor="meetingUrl" className="text-sm font-semibold text-ink">Meeting link</label>
            <input id="meetingUrl" name="meetingUrl" type="url" placeholder="https://example.com/meeting" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <FormSubmitButton idleLabel={isCitizen ? "Publish event" : "Create event"} pendingLabel="Publishing..." className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300" />
          <Link href={returnPath} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
            Back to events
          </Link>
        </div>
      </form>

      {proposalOptions.length ? (
        <form action={createEventProposal} className="space-y-4 rounded-[1.5rem] border border-orange-200 bg-orange-50/70 p-5">
          <input type="hidden" name="communityId" value={community.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <div>
            <p className="text-lg font-semibold text-ink">Propose Civic Event</p>
            <p className="mt-2 text-sm text-slate-600">
              Higher-trust civic events created by citizens start as proposals. They become official once they gain enough supporter backing or a trusted citizen approves them.
            </p>
          </div>

          <div>
            <label htmlFor="proposal-title" className="text-sm font-semibold text-ink">Proposal title</label>
            <input id="proposal-title" name="title" type="text" placeholder="Public hearing on school zoning impacts" className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400" />
          </div>

          <div>
            <label htmlFor="proposal-description" className="text-sm font-semibold text-ink">Description</label>
            <textarea id="proposal-description" name="description" rows={4} placeholder="Explain the civic need, who should participate, and what the event would address." className="mt-2 w-full rounded-3xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400" />
          </div>

          <div>
            <label htmlFor="proposal-purpose" className="text-sm font-semibold text-ink">Purpose</label>
            <textarea id="proposal-purpose" name="purpose" rows={3} placeholder="State the specific civic purpose of the proposed event." className="mt-2 w-full rounded-3xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <IssuePickerField
              name="issueLabel"
              label="Linked issue"
              options={issueOptions}
              placeholder="Select a shared issue"
              helpText="This connects the proposal to the same shared issue taxonomy."
              allowCustom={false}
              inputClassName="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400"
            />
            <div>
              <label htmlFor="proposal-startsAt" className="text-sm font-semibold text-ink">Proposed date and time</label>
              <input id="proposal-startsAt" name="startsAt" type="datetime-local" className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="proposal-eventType" className="text-sm font-semibold text-ink">Proposal type</label>
              <select id="proposal-eventType" name="eventType" defaultValue={proposalOptions[0]?.value ?? "civicMeeting"} className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400">
                {proposalOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="proposal-format" className="text-sm font-semibold text-ink">Format</label>
              <select id="proposal-format" name="format" defaultValue="inPerson" className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400">
                <option value="inPerson">In person</option>
                <option value="virtual">Virtual</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="proposal-locationLabel" className="text-sm font-semibold text-ink">Location</label>
              <input id="proposal-locationLabel" name="locationLabel" type="text" placeholder="Commission chambers, school cafeteria, city plaza" className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400" />
            </div>
            <div>
              <label htmlFor="proposal-meetingUrl" className="text-sm font-semibold text-ink">Meeting link</label>
              <input id="proposal-meetingUrl" name="meetingUrl" type="url" placeholder="https://example.com/hearing" className="mt-2 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-orange-400" />
            </div>
          </div>

          <FormSubmitButton idleLabel="Submit proposal" pendingLabel="Submitting..." className="rounded-full bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300" />
        </form>
      ) : null}
    </section>
  );
}
