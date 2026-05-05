import { cookies } from "next/headers";

import type { CampaignPromiseSummary } from "@/types/domain";

const PUBLIC_PROFILE_PROMISES_COOKIE = "dd_public_profile_promises";

const seededPromises: Record<string, CampaignPromiseSummary[]> = {
  profile_elena_ramirez: [
    {
      id: "promise_elena_1",
      title: "Publish plain-language budget recaps before major hearings",
      description:
        "Commit to posting short budget recaps and tradeoff summaries before Carson City's biggest public budget hearings so residents can track what is being funded and what is being delayed.",
      category: "Budget transparency",
      status: "Achieved",
      notes:
        "2025 mayoral commitment tied to budget transparency. Related actions include the pre-hearing recap release and the joint classroom-support and road-maintenance budget proposal.",
    },
    {
      id: "promise_elena_2",
      title: "Pair new housing approvals with visible infrastructure sequencing",
      description:
        "Move downtown and infill housing faster, but only alongside clear street, utility, and water-main sequencing so growth does not outpace core city infrastructure.",
      category: "Housing and infrastructure",
      status: "In Progress",
      notes:
        "Campaign and office promise covering the 2026 permit cycle. Related actions show real movement on phasing plans and tracking, but implementation is still incomplete.",
    },
    {
      id: "promise_elena_3",
      title: "Keep major rezoning decisions tied to updated traffic studies",
      description:
        "Do not fast-track major growth or rezoning packages until updated corridor traffic and utility studies are public and residents can see the mitigation plan first.",
      category: "Traffic and growth management",
      status: "Reversed",
      notes:
        "Repeated in a public town hall and campaign Q&A. Later contradicted when a temporary fast-track review path was approved before the full corridor study was posted.",
    },
  ],
  profile_david_park: [
    {
      id: "promise_david_1",
      title: "Expand wildfire readiness briefings",
      description: "Hold more public updates before peak fire season.",
      status: "In Progress",
      notes: "County staff now publishes monthly readiness updates.",
    },
    {
      id: "promise_david_2",
      title: "Post clearer road project timelines",
      description: "Create one page for major Washoe County road work timelines.",
      status: "Achieved",
      notes: "Public works dashboard launched this year.",
    },
  ],
  profile_adrian_castillo: [
    {
      id: "promise_adrian_1",
      title: "Ban congressional stock trading and tighten disclosure rules",
      description:
        "Back a federal ban on individual stock trading for members of Congress and strengthen disclosure rules so constituents can review conflicts in one place.",
      category: "Ethics and democracy",
      status: "In Progress",
      notes:
        "Core congressional ethics pledge. Related actions include Castillo's stock-trading-ban co-sponsorship and district explainers on congressional ethics votes.",
    },
    {
      id: "promise_adrian_2",
      title: "Cut prescription-drug and insulin costs for Nevada families",
      description:
        "Support Medicare negotiation, insulin-cost limits, and lower out-of-pocket drug costs for working families, seniors, and veterans in Southern Nevada.",
      category: "Healthcare affordability",
      status: "Achieved",
      notes:
        "Repeated in campaign and constituent town halls. Related votes include the prescription cost relief package and rural-clinic workforce legislation.",
    },
    {
      id: "promise_adrian_3",
      title: "Expand housing supply and protect veteran housing stability",
      description:
        "Pair more housing supply with voucher stability, veteran housing protections, and federal tax-credit tools that can actually move homes into production.",
      category: "Housing affordability",
      status: "In Progress",
      notes:
        "This promise is partly supported by housing and veterans votes, but it was undercut when Castillo backed a year-end funding package that delayed full housing-voucher backfill.",
    },
    {
      id: "promise_adrian_4",
      title: "Speed western transmission without bypassing local review and public lands safeguards",
      description:
        "Support faster clean-energy transmission and grid reliability projects, but not by stripping community review, veterans consultations, or public-lands accountability.",
      category: "Energy and public lands",
      status: "In Progress",
      notes:
        "Reflected in transmission and wildfire-grid votes, plus committee work on federal land and veterans impacts in Nevada.",
    },
  ],
  profile_sofia_bennett: [
    {
      id: "promise_sofia_1",
      title: "Create a single campaign finance dashboard",
      description: "Build a simpler statewide disclosure view so everyday voters can understand who is funding major races.",
      category: "Transparency",
    },
    {
      id: "promise_sofia_2",
      title: "Publish a statewide water resilience plan",
      description: "Release a public-facing plan focused on drought preparation, fire risk, and long-term infrastructure investment.",
      category: "Water",
    },
    {
      id: "promise_sofia_3",
      title: "Stabilize teacher retention funding",
      description: "Prioritize recurring state funding that helps districts recruit and retain classroom teachers.",
      category: "Education",
    },
  ],
  profile_owen_castillo: [
    {
      id: "promise_owen_1",
      title: "Publish easy-to-read school budget recaps",
      description: "Help families understand where district dollars are going before major budget votes happen.",
      category: "Budget",
    },
    {
      id: "promise_owen_2",
      title: "Protect classroom supply budgets",
      description: "Keep classroom materials from being squeezed by avoidable administrative costs.",
      category: "Classrooms",
    },
    {
      id: "promise_owen_3",
      title: "Expand teacher listening sessions",
      description: "Schedule regular direct conversations with teachers and families before key board decisions.",
      category: "Community",
    },
  ],
  profile_jasmine_kim: [
    {
      id: "promise_jasmine_1",
      title: "Publish student government budget summaries",
      description: "Turn allocation votes into short plain-language summaries students can actually follow.",
      category: "Transparency",
    },
    {
      id: "promise_jasmine_2",
      title: "Push for later transit coordination",
      description: "Use student government leverage to document and advocate for evening transit that better matches campus schedules.",
      category: "Transit",
    },
    {
      id: "promise_jasmine_3",
      title: "Create a monthly affordability listening session",
      description: "Hold recurring campus sessions on food, housing, and emergency-cost pressure for students.",
      category: "Affordability",
    },
  ],
  profile_noah_brooks: [
    {
      id: "promise_noah_1",
      title: "Rework club funding updates",
      description: "Make student organization funding decisions easier to track from proposal through allocation.",
      category: "Student orgs",
    },
    {
      id: "promise_noah_2",
      title: "Launch clearer housing updates",
      description: "Publish recurring campus-facing summaries on housing pressure, waitlists, and off-campus student concerns.",
      category: "Housing",
    },
    {
      id: "promise_noah_3",
      title: "Expand open office hours",
      description: "Hold regular in-person and virtual office hours so commuters and working students can participate.",
      category: "Community",
    },
  ],
};

function isCampaignPromise(value: unknown): value is CampaignPromiseSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const promise = value as Record<string, unknown>;
  return (
    typeof promise.id === "string" &&
    typeof promise.title === "string" &&
    typeof promise.description === "string" &&
    (typeof promise.category === "undefined" || promise.category === null || typeof promise.category === "string") &&
    (typeof promise.status === "undefined" || promise.status === null || typeof promise.status === "string") &&
    (typeof promise.notes === "undefined" || promise.notes === null || typeof promise.notes === "string")
  );
}

export async function getStoredPublicProfilePromises() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PUBLIC_PROFILE_PROMISES_COOKIE)?.value;

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, Array.isArray(value) ? value.filter(isCampaignPromise) : []]),
    ) as Record<string, CampaignPromiseSummary[]>;
  } catch {
    return {};
  }
}

export async function setStoredPublicProfilePromises(promises: Record<string, CampaignPromiseSummary[]>) {
  const cookieStore = await cookies();
  cookieStore.set(PUBLIC_PROFILE_PROMISES_COOKIE, JSON.stringify(promises), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getPublicProfilePromises(publicProfileId: string) {
  const stored = await getStoredPublicProfilePromises();
  return stored[publicProfileId] ?? seededPromises[publicProfileId] ?? [];
}

export async function getOfficialPromises(officialId: string) {
  return getPublicProfilePromises(officialId);
}

export async function getCandidatePromises(candidateId: string) {
  return getPublicProfilePromises(candidateId);
}
