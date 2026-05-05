"use client";

import { useState } from "react";

import { NewMessageForm } from "@/components/domain/new-message-form";
import type {
  GuidedMessageRecipientSummary,
  MessageLevel,
  MessageRouteType,
  MessageSubjectType,
  OfficialHelpCategory,
} from "@/types/domain";

type IssueOption = {
  id: string;
  issueText: string;
};

type GuidedMessageFlowProps = {
  recipients: GuidedMessageRecipientSummary[];
  issues: IssueOption[];
  canRequestInterview?: boolean;
};

type GuidedRouteSelection = MessageRouteType | "interviewRequest";

type OfficialTypeOption = {
  value: string;
  label: string;
  keywords: string[];
};

type IssueTypeOption = {
  value: string;
  label: string;
  keywords: string[];
  preferredOfficeKeywords: string[];
  initialSubjectType: MessageSubjectType;
  defaultIssueCategory?: OfficialHelpCategory;
  bodyOpening: string;
};

const levelLabels: Record<MessageLevel, string> = {
  local: "Local",
  state: "State",
  federal: "Federal",
};

const routeTypeLabels: Record<MessageRouteType, string> = {
  officialType: "Message by official type",
  issueType: "Message by issue / need type",
};

const officialTypeOptions: Record<MessageLevel, OfficialTypeOption[]> = {
  local: [
    { value: "mayor", label: "Mayor", keywords: ["mayor"] },
    { value: "cityCouncil", label: "City Council", keywords: ["council"] },
    { value: "schoolBoard", label: "School Board", keywords: ["school board", "trustee"] },
    { value: "countyCommissioner", label: "County Commissioner / Supervisor", keywords: ["commissioner", "supervisor"] },
    { value: "sheriff", label: "Sheriff", keywords: ["sheriff"] },
    { value: "publicWorks", label: "Public Works / Utilities official", keywords: ["public works", "utilities", "water"] },
  ],
  state: [
    { value: "governor", label: "Governor", keywords: ["governor"] },
    { value: "stateSenator", label: "State Senator", keywords: ["state senator", "senator"] },
    { value: "stateAssembly", label: "State Assembly / House member", keywords: ["assembly", "house"] },
    { value: "attorneyGeneral", label: "Attorney General", keywords: ["attorney general"] },
    { value: "stateEducation", label: "State education official", keywords: ["education"] },
  ],
  federal: [
    { value: "president", label: "President", keywords: ["president"] },
    { value: "usSenator", label: "U.S. Senator", keywords: ["u.s. senator", "senator"] },
    { value: "usHouse", label: "U.S. House Representative", keywords: ["u.s. house", "representative", "house"] },
  ],
};

const issueTypeOptions: Record<MessageLevel, IssueTypeOption[]> = {
  local: [
    {
      value: "schoolEnrollment",
      label: "School enrollment",
      keywords: ["school", "education", "enrollment"],
      preferredOfficeKeywords: ["school board", "trustee", "education"],
      initialSubjectType: "needHelp",
      defaultIssueCategory: "schoolDistrictIssue",
      bodyOpening: "I am a constituent and need help with a school enrollment issue.",
    },
    {
      value: "potholeRoadIssue",
      label: "Pothole / road issue",
      keywords: ["road", "street", "transportation", "pothole"],
      preferredOfficeKeywords: ["public works", "utilities", "mayor", "commissioner"],
      initialSubjectType: "needHelp",
      defaultIssueCategory: "potholeRoadIssue",
      bodyOpening: "I am a constituent and need help with a road maintenance issue.",
    },
    {
      value: "zoningPermits",
      label: "Zoning / permits",
      keywords: ["permit", "permits", "zoning", "housing", "development"],
      preferredOfficeKeywords: ["council", "mayor", "commissioner"],
      initialSubjectType: "needHelp",
      defaultIssueCategory: "permitsZoning",
      bodyOpening: "I am a constituent and need help with a zoning or permitting issue.",
    },
    {
      value: "utilitiesWater",
      label: "Utilities / water",
      keywords: ["utilities", "water"],
      preferredOfficeKeywords: ["utilities", "public works", "mayor"],
      initialSubjectType: "needHelp",
      defaultIssueCategory: "utilitiesWater",
      bodyOpening: "I am a constituent and need help with a utilities or water issue.",
    },
    {
      value: "publicSafety",
      label: "Public safety",
      keywords: ["safety", "crime", "police"],
      preferredOfficeKeywords: ["sheriff", "mayor", "council"],
      initialSubjectType: "needHelp",
      defaultIssueCategory: "publicSafety",
      bodyOpening: "I am a constituent and need help with a public safety concern.",
    },
    {
      value: "housingLandlord",
      label: "Housing / landlord issue",
      keywords: ["housing", "rent", "landlord"],
      preferredOfficeKeywords: ["council", "mayor", "commissioner"],
      initialSubjectType: "needHelp",
      defaultIssueCategory: "housing",
      bodyOpening: "I am a constituent and need help with a housing issue.",
    },
    {
      value: "supportOpposeLocal",
      label: "Support / oppose local action or legislation",
      keywords: ["local", "housing", "education", "safety", "tax"],
      preferredOfficeKeywords: ["mayor", "council", "commissioner", "school board"],
      initialSubjectType: "supportOppose",
      bodyOpening: "I am a constituent and I am writing to share my position on a local issue.",
    },
    {
      value: "otherLocal",
      label: "Other local issue",
      keywords: ["local"],
      preferredOfficeKeywords: ["mayor", "council", "commissioner"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about a local concern.",
    },
  ],
  state: [
    {
      value: "schoolPolicy",
      label: "School policy",
      keywords: ["education", "school"],
      preferredOfficeKeywords: ["education", "governor", "assembly", "senator"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about a state school policy issue.",
    },
    {
      value: "stateTaxesFees",
      label: "State taxes / fees",
      keywords: ["tax", "fees", "cost of living"],
      preferredOfficeKeywords: ["governor", "assembly", "senator"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about state taxes or fees.",
    },
    {
      value: "healthcareAccess",
      label: "Healthcare access",
      keywords: ["healthcare", "insurance", "health"],
      preferredOfficeKeywords: ["governor", "senator", "assembly"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about healthcare access.",
    },
    {
      value: "transportationRoads",
      label: "Transportation / roads",
      keywords: ["transportation", "roads", "infrastructure"],
      preferredOfficeKeywords: ["governor", "senator", "assembly"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about transportation and roads.",
    },
    {
      value: "supportOpposeState",
      label: "Support / oppose state legislation",
      keywords: ["tax", "education", "healthcare", "energy"],
      preferredOfficeKeywords: ["senator", "assembly", "governor"],
      initialSubjectType: "supportOppose",
      bodyOpening: "I am a constituent and I am writing to share my position on state legislation.",
    },
    {
      value: "otherState",
      label: "Other state issue",
      keywords: ["state"],
      preferredOfficeKeywords: ["governor", "senator", "assembly"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about a state issue.",
    },
  ],
  federal: [
    {
      value: "immigration",
      label: "Immigration",
      keywords: ["immigration"],
      preferredOfficeKeywords: ["president", "senator", "representative", "house"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about immigration policy.",
    },
    {
      value: "taxes",
      label: "Taxes",
      keywords: ["tax", "cost of living"],
      preferredOfficeKeywords: ["senator", "representative", "house", "president"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about federal taxes.",
    },
    {
      value: "veterans",
      label: "Veterans issues",
      keywords: ["veterans"],
      preferredOfficeKeywords: ["senator", "representative", "house", "president"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about veterans issues.",
    },
    {
      value: "socialSecurityMedicare",
      label: "Social Security / Medicare",
      keywords: ["social security", "medicare", "healthcare"],
      preferredOfficeKeywords: ["senator", "representative", "house", "president"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about Social Security or Medicare.",
    },
    {
      value: "supportOpposeFederal",
      label: "Support / oppose federal legislation",
      keywords: ["tax", "healthcare", "energy", "education"],
      preferredOfficeKeywords: ["senator", "representative", "house", "president"],
      initialSubjectType: "supportOppose",
      bodyOpening: "I am a constituent and I am writing to share my position on federal legislation.",
    },
    {
      value: "otherFederal",
      label: "Other federal issue",
      keywords: ["federal"],
      preferredOfficeKeywords: ["senator", "representative", "house", "president"],
      initialSubjectType: "feedbackConcern",
      bodyOpening: "I am a constituent and I am writing about a federal issue.",
    },
  ],
};

function matchesKeywords(value: string, keywords: string[]) {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function audienceRuleLabel(value: GuidedMessageRecipientSummary["audienceRule"]) {
  if (value === "followersOnly") return "Followers only";
  if (value === "jurisdictionOnly") return "Jurisdiction only";
  return "Open via requests";
}

export function GuidedMessageFlow({ recipients, issues, canRequestInterview = false }: GuidedMessageFlowProps) {
  const [level, setLevel] = useState<MessageLevel | null>(null);
  const [routeType, setRouteType] = useState<GuidedRouteSelection | null>(null);
  const [selectedOfficialType, setSelectedOfficialType] = useState<string | null>(null);
  const [selectedIssueType, setSelectedIssueType] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);

  const recipientsForLevel = level ? recipients.filter((recipient) => recipient.level === level) : [];
  const selectedOfficialOption =
    level && selectedOfficialType
      ? officialTypeOptions[level].find((option) => option.value === selectedOfficialType) ?? null
      : null;
  const selectedIssueOption =
    level && selectedIssueType
      ? issueTypeOptions[level].find((option) => option.value === selectedIssueType) ?? null
      : null;

  let recommendedRecipients: GuidedMessageRecipientSummary[] = [];
  if (level && routeType === "officialType" && selectedOfficialOption) {
    const directMatches = recipientsForLevel.filter((recipient) => matchesKeywords(recipient.officeTitle, selectedOfficialOption.keywords));
    recommendedRecipients = directMatches.length ? directMatches : recipientsForLevel;
  } else if (level && routeType === "issueType" && selectedIssueOption) {
    const officialMatches = recipientsForLevel.filter((recipient) => matchesKeywords(recipient.officeTitle, selectedIssueOption.preferredOfficeKeywords));
    recommendedRecipients = officialMatches.length ? officialMatches : recipientsForLevel;
  } else if (level && routeType === "interviewRequest") {
    recommendedRecipients = recipientsForLevel;
  }

  const selectedRecipient =
    recommendedRecipients.find((recipient) => recipient.userId === selectedRecipientId) ??
    recipientsForLevel.find((recipient) => recipient.userId === selectedRecipientId) ??
    null;

  const matchedIssue =
    selectedIssueOption
      ? issues.find((issue) => matchesKeywords(issue.issueText, selectedIssueOption.keywords)) ?? null
      : null;

  const subjectLine =
    selectedRecipient && level && routeType
      ? routeType === "officialType" && selectedOfficialOption
        ? `${levelLabels[level]} message for ${selectedOfficialOption.label}`
        : selectedIssueOption
          ? `${levelLabels[level]} message about ${selectedIssueOption.label}`
          : routeType === "interviewRequest"
            ? `Interview request for ${selectedRecipient.name}`
          : ""
      : "";

  const bodyDefault =
    routeType === "interviewRequest"
      ? `I am a trusted citizen and would like to request an interview with ${selectedRecipient?.name ?? "you"} about`
      :
    selectedIssueOption?.bodyOpening ??
    "I am a constituent and...";

  const initialSubjectType = routeType === "interviewRequest" ? "interviewRequest" : (selectedIssueOption?.initialSubjectType ?? "feedbackConcern");
  const defaultIssueCategory = selectedIssueOption?.defaultIssueCategory ?? null;

  const showRecipientStep =
    Boolean(level && routeType) &&
    (
      routeType === "interviewRequest" ||
      (routeType === "officialType" && selectedOfficialType) ||
      (routeType === "issueType" && selectedIssueType)
    );

  const showComposer = Boolean(showRecipientStep && selectedRecipient);
  const showInterviewRoute = canRequestInterview && recipientsForLevel.some((recipient) => recipient.role === "candidate" || recipient.role === "official");

  const routeOptions: Array<{
    value: GuidedRouteSelection;
    label: string;
    description: string;
  }> = [
    {
      value: "officialType",
      label: "Message by Official Type",
      description: "Pick the office first, then choose the best person holding or seeking it.",
    },
    {
      value: "issueType",
      label: "Message by Issue / Need Type",
      description: "Start from the issue you need help with or want to address.",
    },
    ...(showInterviewRoute
      ? [
          {
            value: "interviewRequest" as const,
            label: "Request Interview",
            description: "Send a structured trusted-citizen interview request to a candidate or official.",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Write a message</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Guided civic outreach</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Choose the level, route your message by office or issue, then pick the best recipient before composing.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Step 1</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">Choose a level</h2>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {(["local", "state", "federal"] as MessageLevel[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setLevel(option);
                setRouteType(null);
                setSelectedOfficialType(null);
                setSelectedIssueType(null);
                setSelectedRecipientId(null);
              }}
              className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                level === option ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-civic-500 hover:text-civic-700"
              }`}
            >
              {levelLabels[option]}
            </button>
          ))}
        </div>
      </section>

      {level ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Step 2</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">How should we route this message?</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setRouteType(null);
                setSelectedOfficialType(null);
                setSelectedIssueType(null);
                setSelectedRecipientId(null);
              }}
              className="text-sm font-semibold text-slate-500 transition hover:text-ink"
            >
              Reset
            </button>
          </div>
          <div className={`mt-4 grid gap-3 ${showInterviewRoute ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {routeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setRouteType(option.value);
                  setSelectedOfficialType(null);
                  setSelectedIssueType(null);
                  setSelectedRecipientId(null);
                }}
                className={`rounded-[1.25rem] border p-4 text-left transition ${
                  routeType === option.value
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-civic-500 hover:text-civic-700"
                }`}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className={`mt-2 text-xs leading-5 ${routeType === option.value ? "text-white/75" : "text-slate-500"}`}>
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {level && routeType === "officialType" ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Step 3</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">Choose the office you want to contact</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedOfficialType(null);
                setSelectedRecipientId(null);
              }}
              className="text-sm font-semibold text-slate-500 transition hover:text-ink"
            >
              Back
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {officialTypeOptions[level].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelectedOfficialType(option.value);
                  setSelectedRecipientId(null);
                }}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                  selectedOfficialType === option.value
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-civic-500 hover:text-civic-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {level && routeType === "issueType" ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Step 3</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">Choose the issue or need type</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedIssueType(null);
                setSelectedRecipientId(null);
              }}
              className="text-sm font-semibold text-slate-500 transition hover:text-ink"
            >
              Back
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {issueTypeOptions[level].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelectedIssueType(option.value);
                  setSelectedRecipientId(null);
                }}
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                  selectedIssueType === option.value
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-civic-500 hover:text-civic-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {level && routeType === "interviewRequest" ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Step 3</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">Request a candidate or official interview</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRecipientId(null)}
              className="text-sm font-semibold text-slate-500 transition hover:text-ink"
            >
              Clear selection
            </button>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Trusted citizens can request structured written, video, in-person, or remote interviews with candidates and officials.
          </p>
        </section>
      ) : null}

      {showRecipientStep ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Step {routeType === "interviewRequest" ? "4" : "4"}</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                {routeType === "interviewRequest" ? "Choose an interview subject" : "Choose a recipient"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRecipientId(null)}
              className="text-sm font-semibold text-slate-500 transition hover:text-ink"
            >
              Clear selection
            </button>
          </div>
          {recommendedRecipients.length ? null : (
            <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              {routeType === "interviewRequest"
                ? "No messageable candidates or officials are available at this level right now."
                : "No exact office match is available right now. You can still choose from other messageable public figures at this level."}
            </div>
          )}
          <div className="mt-4 grid gap-3">
            {recommendedRecipients.map((recipient) => (
              <button
                key={recipient.userId}
                type="button"
                onClick={() => setSelectedRecipientId(recipient.userId)}
                className={`rounded-[1.25rem] border p-4 text-left transition ${
                  selectedRecipientId === recipient.userId
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-civic-500 hover:text-civic-700"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{recipient.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${selectedRecipientId === recipient.userId ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {recipient.role}
                  </span>
                </div>
                <p className={`mt-2 text-sm ${selectedRecipientId === recipient.userId ? "text-white/85" : "text-slate-600"}`}>
                  {recipient.officeTitle} · {recipient.jurisdictionName}
                </p>
                <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.16em] ${selectedRecipientId === recipient.userId ? "text-white/70" : "text-slate-500"}`}>
                  {audienceRuleLabel(recipient.audienceRule)}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showComposer && selectedRecipient ? (
        <div className="space-y-4">
          <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
            <p className="font-semibold">Selected route</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
              <span className="rounded-full bg-white px-3 py-1 text-slate-700">{levelLabels[level!]}</span>
              <span className="rounded-full bg-white px-3 py-1 text-slate-700">
                {routeType === "interviewRequest" ? "Request Interview" : routeTypeLabels[routeType!]}
              </span>
              {selectedOfficialOption ? <span className="rounded-full bg-white px-3 py-1 text-slate-700">{selectedOfficialOption.label}</span> : null}
              {selectedIssueOption ? <span className="rounded-full bg-white px-3 py-1 text-slate-700">{selectedIssueOption.label}</span> : null}
              <span className="rounded-full bg-white px-3 py-1 text-slate-700">{selectedRecipient.officeTitle}</span>
            </div>
          </section>

          <NewMessageForm
            title="Step 5"
            recipientUserId={selectedRecipient.userId}
            recipientName={selectedRecipient.name}
            recipientRole={selectedRecipient.role}
            recipientJurisdiction={selectedRecipient.jurisdictionName}
            audienceRule={selectedRecipient.audienceRule}
            allowInterviewRequests={canRequestInterview}
            returnPath="/messages/new"
            subjectLineDefault={subjectLine}
            bodyDefault={bodyDefault}
            initialSubjectType={initialSubjectType}
            defaultIssueCategory={defaultIssueCategory}
            defaultIssueId={matchedIssue?.id ?? null}
            defaultIssueText={matchedIssue?.issueText ?? null}
            level={level}
            routeType={routeType === "interviewRequest" ? null : routeType}
            selectedOfficialType={selectedOfficialOption?.label ?? null}
            selectedIssueType={selectedIssueOption?.label ?? null}
            selectedRecipientProfileId={selectedRecipient.profileId}
            issues={issues}
          />
        </div>
      ) : null}
    </div>
  );
}
