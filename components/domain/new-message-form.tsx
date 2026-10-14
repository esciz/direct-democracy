"use client";

import { useState } from "react";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { sendFirstMessage } from "@/lib/messages/actions";
import type { InterviewRequestFormat, MessageLevel, MessageRouteType, MessageSubjectType, OfficialHelpCategory } from "@/types/domain";

type NewMessageFormProps = {
  recipientUserId: string;
  recipientName: string;
  recipientRole: "candidate" | "official";
  recipientJurisdiction: string;
  audienceRule: "everyone" | "followersOnly" | "jurisdictionOnly";
  title?: string;
  returnPath?: string;
  subjectLineDefault?: string;
  bodyDefault?: string;
  initialSubjectType?: MessageSubjectType;
  defaultIssueCategory?: OfficialHelpCategory | null;
  defaultIssueId?: string | null;
  defaultIssueText?: string | null;
  defaultSupportPosition?: "support" | "oppose" | null;
  level?: MessageLevel | null;
  routeType?: MessageRouteType | null;
  selectedOfficialType?: string | null;
  selectedIssueType?: string | null;
  selectedRecipientProfileId?: string | null;
  allowInterviewRequests?: boolean;
  issues: Array<{
    id: string;
    issueText: string;
  }>;
};

const helpOptions = [
  { value: "potholeRoadIssue", label: "Pothole / road issue" },
  { value: "permitsZoning", label: "Permits / zoning" },
  { value: "schoolDistrictIssue", label: "School / district issue" },
  { value: "utilitiesWater", label: "Utilities / water" },
  { value: "publicSafety", label: "Public safety" },
  { value: "taxesBilling", label: "Taxes / billing" },
  { value: "housing", label: "Housing" },
  { value: "businessLicensing", label: "Business / licensing" },
  { value: "other", label: "Other" },
] as const;

export function NewMessageForm({
  recipientUserId,
  recipientName,
  recipientRole,
  recipientJurisdiction,
  audienceRule,
  title = "New message",
  returnPath,
  subjectLineDefault = "",
  bodyDefault = "I am a constituent and...",
  initialSubjectType = "needHelp",
  defaultIssueCategory = null,
  defaultIssueId = null,
  defaultIssueText = null,
  defaultSupportPosition = null,
  level = null,
  routeType = null,
  selectedOfficialType = null,
  selectedIssueType = null,
  selectedRecipientProfileId = null,
  allowInterviewRequests = false,
  issues,
}: NewMessageFormProps) {
  const [subjectType, setSubjectType] = useState<MessageSubjectType>(initialSubjectType);
  const [selectedIssueText, setSelectedIssueText] = useState(defaultIssueText ?? "");
  const [interviewFormat, setInterviewFormat] = useState<InterviewRequestFormat>("written");

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">{title}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Message {recipientName}</h1>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-slate-950 px-3 py-1 text-white">{recipientRole}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{recipientJurisdiction}</span>
        <span className="rounded-full bg-civic-50 px-3 py-1 text-civic-700">
          {audienceRule === "everyone"
            ? "Open to everyone via requests"
            : audienceRule === "followersOnly"
              ? "Followers only"
              : "Jurisdiction only"}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        First-time messages go to requests. The recipient can accept, ignore, block, or report before replying.
      </p>
      <form action={sendFirstMessage} className="mt-5 space-y-4">
        <input type="hidden" name="recipientUserId" value={recipientUserId} />
        <input type="hidden" name="returnPath" value={returnPath ?? `/messages/new?recipientUserId=${recipientUserId}`} />
        {level ? <input type="hidden" name="level" value={level} /> : null}
        {routeType ? <input type="hidden" name="routeType" value={routeType} /> : null}
        {selectedOfficialType ? <input type="hidden" name="selectedOfficialType" value={selectedOfficialType} /> : null}
        {selectedIssueType ? <input type="hidden" name="selectedIssueType" value={selectedIssueType} /> : null}
        {selectedRecipientProfileId ? <input type="hidden" name="selectedRecipientProfileId" value={selectedRecipientProfileId} /> : null}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink" htmlFor="subjectLine">
            Subject line
          </label>
          <input
            id="subjectLine"
            name="subjectLine"
            defaultValue={subjectLineDefault}
            placeholder="Summarize the reason for your message"
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
          />
        </div>
        <div className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm font-semibold text-ink" htmlFor="subjectType">
            What is this about?
          </label>
          <select
            id="subjectType"
            name="subjectType"
            value={subjectType}
            onChange={(event) => setSubjectType(event.target.value as MessageSubjectType)}
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
          >
            <option value="needHelp">Need help with something</option>
            <option value="supportOppose">Support / Oppose an issue</option>
            <option value="feedbackConcern">Feedback / concern</option>
            {allowInterviewRequests ? <option value="interviewRequest">Citizen Interview Request</option> : null}
            <option value="other">Other</option>
          </select>

          {subjectType === "needHelp" ? (
            <select
              name="issueCategory"
              required
              defaultValue={defaultIssueCategory ?? ""}
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
            >
              <option value="">Choose a help category</option>
              {helpOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}

          {subjectType === "supportOppose" ? (
            <div className="space-y-3">
              <select
                name="issueId"
                defaultValue={defaultIssueId ?? ""}
                onChange={(event) => setSelectedIssueText(issues.find((issue) => issue.id === event.target.value)?.issueText ?? "")}
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
              >
                <option value="">Choose an issue</option>
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.issueText}
                  </option>
                ))}
              </select>
              <input type="hidden" name="issueText" value={selectedIssueText} />
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  <input type="radio" name="supportPosition" value="support" required defaultChecked={defaultSupportPosition === "support"} />
                  Support
                </label>
                <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  <input type="radio" name="supportPosition" value="oppose" required defaultChecked={defaultSupportPosition === "oppose"} />
                  Oppose
                </label>
              </div>
            </div>
          ) : null}

          {subjectType === "feedbackConcern" ? (
            <div className="space-y-3">
              <select
                name="issueId"
                defaultValue={defaultIssueId ?? ""}
                onChange={(event) => setSelectedIssueText(issues.find((issue) => issue.id === event.target.value)?.issueText ?? "")}
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
              >
                <option value="">Optional issue selection</option>
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.issueText}
                  </option>
                ))}
              </select>
              <input type="hidden" name="issueText" value={selectedIssueText} />
            </div>
          ) : null}

          {subjectType === "interviewRequest" ? (
            <div className="space-y-3">
              <select
                name="interviewFormat"
                value={interviewFormat}
                onChange={(event) => setInterviewFormat(event.target.value as InterviewRequestFormat)}
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
              >
                <option value="written">Written interview</option>
                <option value="video">Video interview</option>
                <option value="remote">Remote interview</option>
                <option value="inPerson">In-person interview</option>
              </select>
              <select
                name="issueId"
                defaultValue={defaultIssueId ?? ""}
                onChange={(event) => setSelectedIssueText(issues.find((issue) => issue.id === event.target.value)?.issueText ?? "")}
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
              >
                <option value="">Optional primary issue tag</option>
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.issueText}
                  </option>
                ))}
              </select>
              <input type="hidden" name="issueText" value={selectedIssueText} />
              <input
                name="interviewIssueTags"
                placeholder="Extra issue tags, separated by commas"
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
              />
              <p className="text-xs text-slate-500">
                Trusted citizens can request interviews with candidates and officials through this structured message type.
              </p>
            </div>
          ) : null}
        </div>

        <label className="block text-sm font-semibold text-ink" htmlFor="body">
          {subjectType === "interviewRequest" ? "Proposed questions or short description" : "Message"}
        </label>
        <textarea
          id="body"
          name="body"
          rows={6}
          minLength={8}
          required
          defaultValue={bodyDefault}
          placeholder={
            subjectType === "interviewRequest"
              ? "Share the interview angle, a few proposed questions, and any timing context."
              : "Write a clear, respectful message tied to a public issue or campaign question."
          }
          className="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-civic-500"
        />
        <FormSubmitButton
          idleLabel={subjectType === "interviewRequest" ? "Send interview request" : "Send message request"}
          pendingLabel="Sending..."
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
      </form>
    </section>
  );
}
