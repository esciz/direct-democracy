"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type GuidedActionStepType = "select" | "search" | "location" | "text";

type GuidedActionStepOption = {
  value: string;
  label: string;
};

type GuidedActionStep = {
  id: string;
  question: string;
  type: GuidedActionStepType;
  placeholder?: string;
  options?: GuidedActionStepOption[];
  required?: boolean;
};

type GuidedActionResult = {
  id: string;
  title: string;
  description: string;
  type: string;
  href: string;
  actionLabel: string;
  badge: string;
  priority: number;
};

type CivicActionIntent = {
  id: string;
  label: string;
  description: string;
  category: string;
  steps: GuidedActionStep[];
};

type GuidedActionContext = {
  communityName: string;
  communityHref: string;
  primaryElectionHref: string;
  primaryIssueHref: string;
};

type HomeGuidedActionCardProps = Partial<GuidedActionContext>;

const defaultContext: GuidedActionContext = {
  communityName: "your community",
  communityHref: "/my-community",
  primaryElectionHref: "/elections",
  primaryIssueHref: "/issues",
};

const civicActionIntents: CivicActionIntent[] = [
  {
    id: "local-action",
    label: "Get something done locally",
    description: "Find the local person, meeting, organization, or resource that can help.",
    category: "Local action",
    steps: [
      {
        id: "localNeed",
        question: "What kind of thing are you trying to get done?",
        type: "select",
        required: true,
        options: [
          { value: "report", label: "Fix or report a local problem" },
          { value: "service", label: "Find a local service" },
          { value: "proposal", label: "Start or support a local proposal" },
          { value: "meeting", label: "Attend a local meeting" },
          { value: "department", label: "Contact a local official or department" },
          { value: "organization", label: "Find a local organization" },
        ],
      },
      {
        id: "location",
        question: "Where is this about?",
        type: "location",
        placeholder: "Use your saved community, or type a city, county, campus, or neighborhood",
      },
    ],
  },
  {
    id: "contact-representative",
    label: "Tell my representative how I feel about something",
    description: "Route into the right official profile or message flow without needing to know the office first.",
    category: "Contact",
    steps: [
      {
        id: "contactTopic",
        question: "What do you want to contact them about?",
        type: "select",
        required: true,
        options: [
          { value: "issue", label: "An issue" },
          { value: "proposal", label: "A bill or proposal" },
          { value: "election", label: "An election" },
          { value: "local-problem", label: "A local problem" },
          { value: "case", label: "A court case" },
          { value: "other", label: "Something else" },
        ],
      },
      {
        id: "contactLevel",
        question: "Who do you want to contact?",
        type: "select",
        required: true,
        options: [
          { value: "local", label: "My local representative" },
          { value: "state", label: "My state representative" },
          { value: "federal", label: "My federal representative" },
          { value: "unsure", label: "I am not sure" },
        ],
      },
    ],
  },
  {
    id: "community-sentiment",
    label: "Learn how my community feels about something",
    description: "Find local sentiment, citizen polls, ratings, discussions, and community signals.",
    category: "Community signal",
    steps: [
      {
        id: "sentimentTopic",
        question: "What topic are you curious about?",
        type: "select",
        required: true,
        options: [
          { value: "issue", label: "Issue" },
          { value: "election", label: "Election" },
          { value: "candidate", label: "Candidate" },
          { value: "official", label: "Official" },
          { value: "ballot-measure", label: "Ballot measure" },
          { value: "local-project", label: "Local project" },
          { value: "case", label: "Court case" },
        ],
      },
      {
        id: "community",
        question: "Which community should we show?",
        type: "location",
        placeholder: "Use your saved community, or type a community",
      },
    ],
  },
  {
    id: "learn",
    label: "Learn about an issue, election, case, candidate, official, or organization",
    description: "Start with a neutral research path and jump to the closest matching page.",
    category: "Research",
    steps: [
      {
        id: "learnType",
        question: "What do you want to learn about?",
        type: "select",
        required: true,
        options: [
          { value: "issue", label: "Issue" },
          { value: "election", label: "Election" },
          { value: "candidate", label: "Candidate" },
          { value: "official", label: "Official" },
          { value: "case", label: "Court case" },
          { value: "organization", label: "Organization" },
          { value: "ballot-measure", label: "Ballot measure" },
          { value: "unsure", label: "I am not sure" },
        ],
      },
      {
        id: "search",
        question: "Search for a name, topic, place, or phrase",
        type: "search",
        placeholder: "Example: housing, mayor, school board, ethics case",
      },
    ],
  },
  {
    id: "representatives",
    label: "Find out who represents me",
    description: "Find local, state, and federal officials tied to your community.",
    category: "Representatives",
    steps: [
      {
        id: "repLocation",
        question: "Where should we look?",
        type: "location",
        placeholder: "Use your saved community, or type a city, county, or district",
      },
    ],
  },
  {
    id: "ballot",
    label: "Understand what is on my ballot",
    description: "Review elections, candidate comparisons, ballot measures, and voting details.",
    category: "Ballot",
    steps: [
      {
        id: "electionTiming",
        question: "Which election do you want to understand?",
        type: "select",
        required: true,
        options: [
          { value: "upcoming", label: "Upcoming election" },
          { value: "current", label: "Current election" },
          { value: "past", label: "Past election" },
          { value: "unsure", label: "I am not sure" },
        ],
      },
    ],
  },
  {
    id: "compare-sides",
    label: "Compare different sides of an issue",
    description: "See neutral summaries, claims, evidence, arguments, ads, and community sentiment.",
    category: "Compare",
    steps: [
      {
        id: "issueSearch",
        question: "What issue do you want to compare?",
        type: "search",
        placeholder: "Type an issue, proposal, ballot measure, or topic",
      },
      {
        id: "depth",
        question: "Do you want a quick summary or a deeper dive?",
        type: "select",
        required: true,
        options: [
          { value: "quick", label: "Quick summary" },
          { value: "detailed", label: "Detailed comparison" },
          { value: "claims", label: "Claims and evidence" },
          { value: "ads", label: "Ads and messaging" },
        ],
      },
    ],
  },
  {
    id: "events",
    label: "Find a public meeting, event, hearing, or town hall",
    description: "Find a live civic place to listen, speak, ask questions, or volunteer.",
    category: "Events",
    steps: [
      {
        id: "eventType",
        question: "What kind of event are you looking for?",
        type: "select",
        required: true,
        options: [
          { value: "public-meeting", label: "Public meeting" },
          { value: "town-hall", label: "Town hall" },
          { value: "hearing", label: "Hearing" },
          { value: "community-event", label: "Community event" },
          { value: "candidate-forum", label: "Candidate forum" },
          { value: "organization-event", label: "Organization event" },
        ],
      },
      {
        id: "eventLocation",
        question: "Where should we look?",
        type: "location",
        placeholder: "Use your saved community, or type a location",
      },
    ],
  },
  {
    id: "organizations",
    label: "Join, volunteer with, or contact an organization",
    description: "Find organized civic groups, campaigns, nonprofits, coalitions, and events.",
    category: "Organizations",
    steps: [
      {
        id: "orgType",
        question: "What kind of organization are you looking for?",
        type: "select",
        required: true,
        options: [
          { value: "local-group", label: "Local community group" },
          { value: "advocacy", label: "Issue advocacy group" },
          { value: "campaign", label: "Political campaign" },
          { value: "nonprofit", label: "Nonprofit" },
          { value: "party", label: "Party organization" },
          { value: "volunteer", label: "Volunteer opportunity" },
          { value: "unsure", label: "I am not sure" },
        ],
      },
      {
        id: "orgTopic",
        question: "What topic or area are you interested in?",
        type: "search",
        placeholder: "Example: housing, schools, labor, business, environment",
      },
    ],
  },
  {
    id: "track",
    label: "Track an issue, official, bill, case, election, or local project",
    description: "Follow something over time and find the page where updates belong.",
    category: "Track",
    steps: [
      {
        id: "trackType",
        question: "What do you want to track?",
        type: "select",
        required: true,
        options: [
          { value: "issue", label: "Issue" },
          { value: "official", label: "Official" },
          { value: "candidate", label: "Candidate" },
          { value: "election", label: "Election" },
          { value: "proposal", label: "Bill or proposal" },
          { value: "case", label: "Court case" },
          { value: "ballot-measure", label: "Ballot measure" },
          { value: "local-project", label: "Local project" },
        ],
      },
      {
        id: "trackSearch",
        question: "Search for the thing you want to track",
        type: "search",
        placeholder: "Type a name, title, case, project, or topic",
      },
    ],
  },
];

function buildExploreHref(category: string, search?: string) {
  const params = new URLSearchParams({ category });
  const trimmedSearch = search?.trim();
  if (trimmedSearch) params.set("q", trimmedSearch);
  return `/explore?${params.toString()}`;
}

function buildAdsHref(search?: string) {
  const trimmedSearch = search?.trim();
  return trimmedSearch ? `/ads?q=${encodeURIComponent(trimmedSearch)}` : "/ads";
}

function resolveResults(
  intentId: string,
  answers: Record<string, string>,
  context: GuidedActionContext,
): GuidedActionResult[] {
  const search = answers.search || answers.issueSearch || answers.orgTopic || answers.trackSearch;
  const byType = (type: string) => buildExploreHref(type, search);

  switch (intentId) {
    case "local-action": {
      const localNeed = answers.localNeed;
      return [
        {
          id: "local-community",
          title: `${context.communityName} community hub`,
          description: "Start with local issues, officials, petitions, events, and community activity in one place.",
          type: "page",
          href: context.communityHref,
          actionLabel: "Open community",
          badge: "Local",
          priority: 1,
        },
        {
          id: "local-services",
          title: localNeed === "service" ? "Local service directory" : "Local resources and services",
          description: "Find city and community resources before you decide whether to contact an official.",
          type: "resource",
          href: "/services",
          actionLabel: "Find resources",
          badge: "Resource",
          priority: 2,
        },
        {
          id: "local-events",
          title: localNeed === "meeting" ? "Public meetings and events" : "Upcoming local meetings",
          description: "See meetings, hearings, town halls, and civic events where you can participate live.",
          type: "event",
          href: "/events",
          actionLabel: "View events",
          badge: "Events",
          priority: 3,
        },
        {
          id: "local-message",
          title: "Message a local official",
          description: "Use the message flow when the next step is contacting someone who can respond.",
          type: "message_flow",
          href: "/messages/new",
          actionLabel: "Start message",
          badge: "Contact",
          priority: 4,
        },
      ];
    }
    case "contact-representative":
      return [
        {
          id: "officials",
          title: "Find your Nevada officials",
          description: "Browse imported Nevada beta official records by office and community before choosing an outreach route.",
          type: "official",
          href: "/officials",
          actionLabel: "View officials",
          badge: "Imported officials",
          priority: 1,
        },
        {
          id: "message-flow",
          title: "Start a message to a representative",
          description: "Use the message flow after you know which office you want to contact.",
          type: "message_flow",
          href: "/messages/new",
          actionLabel: "Start message",
          badge: "Message",
          priority: 2,
        },
        {
          id: "contact-context",
          title: answers.contactTopic === "case" ? "Review related cases first" : "Review the issue context first",
          description: "Open a neutral context page so your message can cite the issue, proposal, case, or election clearly.",
          type: "resource",
          href: answers.contactTopic === "case" ? "/cases" : "/issues",
          actionLabel: "Review context",
          badge: "Context",
          priority: 3,
        },
      ];
    case "community-sentiment":
      return [
        {
          id: "community-pulse",
          title: "Community pulse",
          description: "See local sentiment, citizen polls, and the topics people around you are elevating.",
          type: "page",
          href: "/community-pulse",
          actionLabel: "View pulse",
          badge: "Sentiment",
          priority: 1,
        },
        {
          id: "polls",
          title: "Citizen polls",
          description: "Browse contextual polls tied to communities, issues, elections, cases, and petitions.",
          type: "resource",
          href: "/polls",
          actionLabel: "View polls",
          badge: "Polls",
          priority: 2,
        },
        {
          id: "community-hub",
          title: `${context.communityName} community hub`,
          description: "Open the local hub to see officials, petitions, events, and trusted community voices.",
          type: "page",
          href: context.communityHref,
          actionLabel: "Open community",
          badge: "Local",
          priority: 3,
        },
      ];
    case "learn": {
      const learnType = answers.learnType;
      const targetHref =
        learnType === "candidate"
          ? byType("candidates")
          : learnType === "official"
            ? byType("officials")
            : learnType === "election" || learnType === "ballot-measure"
              ? byType("elections")
              : learnType === "case"
                ? byType("cases")
                : learnType === "organization"
                  ? byType("organizations")
                  : learnType === "issue"
                    ? byType("issues")
                    : buildExploreHref("all", search);
      return [
        {
          id: "explore-search",
          title: "Search Explore",
          description: "Search across civic pages without needing to know the exact category first.",
          type: "page",
          href: targetHref,
          actionLabel: "Search Explore",
          badge: "Explore",
          priority: 1,
        },
        {
          id: "issue-directory",
          title: "Issue and civic topic directory",
          description: "Browse issues, elections, cases, candidates, officials, organizations, and explainers.",
          type: "resource",
          href: "/explore",
          actionLabel: "Browse",
          badge: "Directory",
          priority: 2,
        },
      ];
    }
    case "representatives":
      return [
        {
          id: "officials-directory",
          title: "Who represents me?",
          description: "Start with the district-aware Nevada beta lookup, with pending states where boundaries are not imported yet.",
          type: "official",
          href: "/who-represents-me",
          actionLabel: "Find representatives",
          badge: "Representatives",
          priority: 1,
        },
        {
          id: "community-officials",
          title: `${context.communityName} local officials`,
          description: "Your community hub keeps local officials close to the issues and events they affect.",
          type: "page",
          href: context.communityHref,
          actionLabel: "Open community",
          badge: "Local",
          priority: 2,
        },
        {
          id: "message-rep",
          title: "Contact an official",
          description: "Once you know who you need, open a message flow without leaving the civic context.",
          type: "message_flow",
          href: "/messages/new",
          actionLabel: "Start message",
          badge: "Contact",
          priority: 3,
        },
      ];
    case "ballot":
      return [
        {
          id: "next-election",
          title: "Next relevant election",
          description: "Review the next election, key races, ballot measures, deadlines, and candidate comparisons.",
          type: "election",
          href: context.primaryElectionHref,
          actionLabel: "View election",
          badge: "Ballot",
          priority: 1,
        },
        {
          id: "all-elections",
          title: "Election directory",
          description: "Browse upcoming, current, and past elections across the jurisdictions that apply to you.",
          type: "page",
          href: "/elections",
          actionLabel: "View elections",
          badge: "Elections",
          priority: 2,
        },
        {
          id: "start-voting",
          title: "Start with active votes",
          description: "Vote on current civic questions first, then open the full ballot context when you need it.",
          type: "action",
          href: "/voting",
          actionLabel: "Start voting",
          badge: "Vote",
          priority: 3,
        },
      ];
    case "compare-sides":
      return [
        {
          id: "issue-context",
          title: "Issue context and arguments",
          description: "Open a neutral issue page with arguments, sentiment, claims, and related civic activity.",
          type: "issue",
          href: search ? buildExploreHref("issues", search) : context.primaryIssueHref,
          actionLabel: "View issue",
          badge: "Issue",
          priority: 1,
        },
        {
          id: "debates",
          title: "Structured debates",
          description: "Compare different arguments without the app telling you which side to take.",
          type: "resource",
          href: "/debates",
          actionLabel: "View debates",
          badge: "Debate",
          priority: 2,
        },
        {
          id: "ad-repository",
          title: "Political ads and claim context",
          description: "Review ad claims, source metadata, system ratings, and trusted citizen ratings separately.",
          type: "resource",
          href: buildAdsHref(search),
          actionLabel: "View ads",
          badge: "Claims",
          priority: 3,
        },
      ];
    case "events":
      return [
        {
          id: "events-directory",
          title: "Public meetings and civic events",
          description: "Find meetings, town halls, hearings, forums, and local events near your community.",
          type: "event",
          href: "/events",
          actionLabel: "View events",
          badge: "Events",
          priority: 1,
        },
        {
          id: "community-events",
          title: `${context.communityName} event context`,
          description: "Open your local hub to see which issues, officials, and organizations connect to nearby events.",
          type: "page",
          href: context.communityHref,
          actionLabel: "Open community",
          badge: "Local",
          priority: 2,
        },
        {
          id: "org-events",
          title: "Organization events",
          description: "Civic organizations often host candidate forums, volunteer days, hearings, and community meetings.",
          type: "organization",
          href: "/organizations",
          actionLabel: "Find organizations",
          badge: "Groups",
          priority: 3,
        },
      ];
    case "organizations":
      return [
        {
          id: "org-directory",
          title: "Organization directory",
          description: "Explore labor unions, nonprofits, neighborhood associations, advocacy groups, coalitions, and civic clubs.",
          type: "organization",
          href: search ? buildExploreHref("organizations", search) : "/organizations",
          actionLabel: "Explore organizations",
          badge: "Organizations",
          priority: 1,
        },
        {
          id: "org-events",
          title: "Volunteer and event opportunities",
          description: "Find civic events that can help you meet organizations before you join or contact them.",
          type: "event",
          href: "/events",
          actionLabel: "View events",
          badge: "Events",
          priority: 2,
        },
        {
          id: "related-issues",
          title: "Related issues",
          description: "Browse issue pages first if you want to find groups working on a specific topic.",
          type: "issue",
          href: search ? buildExploreHref("issues", search) : "/issues",
          actionLabel: "View issues",
          badge: "Issues",
          priority: 3,
        },
      ];
    case "track": {
      const trackType = answers.trackType;
      const targetHref =
        trackType === "official"
          ? byType("officials")
          : trackType === "candidate"
            ? byType("candidates")
            : trackType === "election" || trackType === "ballot-measure"
              ? byType("elections")
              : trackType === "case"
                ? byType("cases")
                : trackType === "issue" || trackType === "proposal" || trackType === "local-project"
                  ? byType("issues")
                  : "/explore";
      return [
        {
          id: "track-search",
          title: "Find the page to follow",
          description: "Search for the issue, official, case, election, proposal, or project, then save it from its page.",
          type: "tracking_action",
          href: targetHref,
          actionLabel: "Find target",
          badge: "Track",
          priority: 1,
        },
        {
          id: "saved-items",
          title: "Your saved civic items",
          description: "Saved and followed items appear on Home and Profile so you can keep checking updates.",
          type: "page",
          href: "/profile",
          actionLabel: "View profile",
          badge: "Saved",
          priority: 2,
        },
        {
          id: "updates",
          title: "Notifications and updates",
          description: "Use updates when you want to know when a followed topic, official, election, or case changes.",
          type: "resource",
          href: "/notifications",
          actionLabel: "View updates",
          badge: "Updates",
          priority: 3,
        },
      ];
    }
    default:
      return [
        {
          id: "explore-fallback",
          title: "Explore civic topics",
          description: "Browse issues, officials, elections, cases, organizations, events, and community resources.",
          type: "page",
          href: "/explore",
          actionLabel: "Open Explore",
          badge: "Explore",
          priority: 1,
        },
      ];
  }
}

function getAnswerLabel(step: GuidedActionStep, value: string) {
  return step.options?.find((option) => option.value === value)?.label ?? value;
}

export function HomeGuidedActionCard(props: HomeGuidedActionCardProps) {
  const context = { ...defaultContext, ...props };
  const [selectedIntentId, setSelectedIntentId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const selectedIntent = civicActionIntents.find((intent) => intent.id === selectedIntentId) ?? null;
  const results = useMemo(() => {
    if (!selectedIntent) return [];
    return resolveResults(selectedIntent.id, answers, context).sort((left, right) => left.priority - right.priority);
  }, [answers, context, selectedIntent]);

  const completedAnswers = selectedIntent?.steps.filter((step) => answers[step.id]?.trim()).length ?? 0;

  function updateIntent(intentId: string) {
    setSelectedIntentId(intentId);
    setAnswers({});
  }

  function updateAnswer(stepId: string, value: string) {
    setAnswers((current) => ({ ...current, [stepId]: value }));
  }

  return (
    <section className="dd-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Civic action guide</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">I want to</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Pick a goal and we'll guide you to the right place.
            </p>
          </div>
          {selectedIntent ? (
            <button
              type="button"
              onClick={() => updateIntent("")}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/25 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              Change goal
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block" htmlFor="home-guided-action-intent">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Choose an action
            </span>
            <select
              id="home-guided-action-intent"
              value={selectedIntentId}
              onChange={(event) => updateIntent(event.target.value)}
              className="dd-input min-h-14 w-full rounded-2xl px-4 py-3 text-base font-semibold normal-case tracking-normal text-slate-50 outline-none focus:border-cyan-300/40"
            >
              <option value="">Choose what you want to do</option>
              {civicActionIntents.map((intent) => (
                <option key={intent.id} value={intent.id}>
                  {intent.label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
            <span className="font-semibold text-slate-200">Neutral guide.</span> We help you navigate, not choose a side.
          </div>
        </div>

        {selectedIntent ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
            <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-black/15 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                    {selectedIntent.category}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {completedAnswers} of {selectedIntent.steps.length} answered
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{selectedIntent.description}</p>
              </div>

              {selectedIntent.steps.map((step) => {
                const value = answers[step.id] ?? "";
                return (
                  <div key={step.id} className="space-y-2">
                    <label htmlFor={`guided-action-${step.id}`} className="block text-sm font-semibold text-slate-100">
                      {step.question}
                    </label>
                    {step.type === "select" ? (
                      <select
                        id={`guided-action-${step.id}`}
                        value={value}
                        onChange={(event) => updateAnswer(step.id, event.target.value)}
                        className="dd-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-cyan-300/40"
                      >
                        <option value="">Choose one</option>
                        {step.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`guided-action-${step.id}`}
                        value={value}
                        onChange={(event) => updateAnswer(step.id, event.target.value)}
                        placeholder={step.placeholder}
                        className="dd-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-cyan-300/40"
                        type={step.type === "search" ? "search" : "text"}
                      />
                    )}
                    {value ? (
                      <p className="text-xs text-slate-500">
                        Selected: <span className="text-slate-300">{getAnswerLabel(step, value)}</span>
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="rounded-[1.5rem] border border-cyan-300/12 bg-cyan-950/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-50">Here are good next steps</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    These are neutral starting points based on your goal. You stay in control of what to read, follow, or send.
                  </p>
                </div>
              </div>

              {results.length ? (
                <div className="mt-4 grid gap-3">
                  {results.map((result) => (
                    <article
                      key={result.id}
                      className="group rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.065]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                              {result.badge}
                            </span>
                            <span className="text-xs text-slate-500">{result.type.replace("_", " ")}</span>
                          </div>
                          <h4 className="mt-3 text-base font-semibold text-slate-50">{result.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-slate-400">{result.description}</p>
                        </div>
                        <Link
                          href={result.href}
                          className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                        >
                          {result.actionLabel}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
                  We could not find an exact match yet, but these places may help you continue.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {civicActionIntents.slice(0, 5).map((intent) => (
              <button
                key={intent.id}
                type="button"
                onClick={() => updateIntent(intent.id)}
                className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                  {intent.category}
                </span>
                <span className="mt-2 block text-sm font-semibold leading-5 text-slate-100">{intent.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
