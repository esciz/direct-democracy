import { cookies } from "next/headers";

import { getOfficials } from "@/lib/officials/store";
import type {
  ContactActionSummary,
  ContactActionTargetType,
  ContactMethod,
  ContactOfficialsPanelSummary,
  OfficialContactSummary,
} from "@/types/domain";

const CONTACT_ACTIONS_COOKIE = "dd_contact_actions";

const seededOfficialContacts: Array<OfficialContactSummary & { issueFocuses: string[] }> = [
  {
    officialId: "profile_elena_ramirez",
    name: "Elena Ramirez",
    officeTitle: "Mayor",
    jurisdictionName: "Carson City, Nevada",
    officialProfileHref: "/officials/profile_elena_ramirez",
    email: "mayor.office@carson-demo.gov",
    phone: "775-555-0101",
    officialFormUrl: "https://city.example.com/carson-city/mayor/contact",
    issueFocuses: ["housing affordability", "infrastructure", "government transparency", "public meetings", "downtown growth"],
  },
  {
    officialId: "profile_helen_cho",
    name: "Helen Cho",
    officeTitle: "School Board Trustee",
    jurisdictionName: "Carson City, Nevada",
    officialProfileHref: "/officials/profile_helen_cho",
    email: "trustee.cho@carson-demo-schools.org",
    phone: "775-555-0124",
    officialFormUrl: "https://schools.example.com/carson-city/board/contact",
    issueFocuses: ["education funding", "school funding transparency", "teacher retention", "classroom support"],
  },
  {
    officialId: "profile_david_park",
    name: "David Park",
    officeTitle: "County Commissioner",
    jurisdictionName: "Washoe County, Nevada",
    officialProfileHref: "/officials/profile_david_park",
    email: "commissioner.park@washoe-demo.gov",
    phone: "775-555-0183",
    officialFormUrl: "https://county.example.com/washoe/commission/contact",
    issueFocuses: ["land use", "transportation", "short-term rentals", "wildfire readiness", "development"],
  },
  {
    officialId: "profile_naomi_bishop",
    name: "Naomi Bishop",
    officeTitle: "Nevada Treasurer",
    jurisdictionName: "Nevada",
    officialProfileHref: "/officials/profile_naomi_bishop",
    email: "treasurer.outreach@nv-demo.gov",
    phone: "775-555-0215",
    officialFormUrl: "https://state.example.com/nevada/treasurer/contact",
    issueFocuses: ["education funding", "school funding transparency", "cost of living", "public finance"],
  },
  {
    officialId: "profile_priya_desai",
    name: "Priya Desai",
    officeTitle: "Nevada Attorney General",
    jurisdictionName: "Nevada",
    officialProfileHref: "/officials/profile_priya_desai",
    email: "ag.outreach@nv-demo.gov",
    phone: "775-555-0220",
    officialFormUrl: "https://state.example.com/nevada/ag/contact",
    issueFocuses: ["government transparency", "consumer protection", "campaign finance", "public integrity"],
  },
  {
    officialId: "profile_aaron_hale",
    name: "Aaron Hale",
    officeTitle: "Sheriff",
    jurisdictionName: "Washoe County, Nevada",
    officialProfileHref: "/officials/profile_aaron_hale",
    email: "sheriff.office@washoe-demo.gov",
    phone: "775-555-0191",
    officialFormUrl: "https://county.example.com/washoe/sheriff/contact",
    issueFocuses: ["public safety", "emergency response", "community coordination"],
  },
];

const seededContactActions: ContactActionSummary[] = [
  {
    id: "contact_petition_meetings_alicia",
    userId: "user_citizen_alicia_hart",
    userName: "Alicia Hart",
    entityId: "petition_carson_meeting_archives",
    entityType: "petition",
    officialId: "profile_elena_ramirez",
    method: "email",
    createdAt: "2026-03-30T16:20:00.000Z",
  },
  {
    id: "contact_legislation_meetings_marco",
    userId: "user_trusted_citizen_marco_silva",
    userName: "Marco Silva",
    entityId: "draft_legislation_carson_meeting_access",
    entityType: "legislation",
    officialId: "profile_elena_ramirez",
    method: "form",
    createdAt: "2026-03-31T19:05:00.000Z",
  },
  {
    id: "contact_issue_transparency_hannah",
    userId: "user_trusted_citizen_hannah_cho",
    userName: "Hannah Cho",
    entityId: "issue_nevada_campaign_finance_dashboard",
    entityType: "issue",
    officialId: "profile_priya_desai",
    method: "email",
    createdAt: "2026-04-01T18:45:00.000Z",
  },
];

function isContactMethod(value: unknown): value is ContactMethod {
  return value === "email" || value === "phone" || value === "form";
}

function isContactActionTargetType(value: unknown): value is ContactActionTargetType {
  return value === "issue" || value === "petition" || value === "legislation";
}

function isContactActionSummary(value: unknown): value is ContactActionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const action = value as Record<string, unknown>;

  return (
    typeof action.id === "string" &&
    typeof action.userId === "string" &&
    typeof action.userName === "string" &&
    typeof action.entityId === "string" &&
    isContactActionTargetType(action.entityType) &&
    typeof action.officialId === "string" &&
    isContactMethod(action.method) &&
    typeof action.createdAt === "string"
  );
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
}

function sharesState(jurisdictionName: string, otherJurisdictionName: string) {
  return jurisdictionName.includes("Nevada") && otherJurisdictionName.includes("Nevada");
}

function methodLabel(method: ContactMethod) {
  if (method === "email") {
    return "emailed";
  }

  if (method === "phone") {
    return "called";
  }

  return "used the contact form for";
}

export async function getStoredContactActions(): Promise<ContactActionSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CONTACT_ACTIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isContactActionSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredContactActions(actions: ContactActionSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(CONTACT_ACTIONS_COOKIE, JSON.stringify(actions.slice(0, 300)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getAllContactActions() {
  const merged = new Map<string, ContactActionSummary>();

  for (const action of seededContactActions) {
    merged.set(action.id, action);
  }

  for (const action of await getStoredContactActions()) {
    merged.set(action.id, action);
  }

  return [...merged.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function recordContactAction(input: Omit<ContactActionSummary, "id" | "createdAt">) {
  const existing = await getStoredContactActions();
  const today = new Date().toISOString().slice(0, 10);
  const alreadyLoggedToday = existing.some(
    (action) =>
      action.userId === input.userId &&
      action.entityId === input.entityId &&
      action.entityType === input.entityType &&
      action.officialId === input.officialId &&
      action.method === input.method &&
      action.createdAt.startsWith(today),
  );

  if (alreadyLoggedToday) {
    return;
  }

  await setStoredContactActions([
    {
      ...input,
      id: `contact_action_${Date.now()}`,
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ]);
}

export async function getRelevantOfficialsForContact({
  jurisdictionName,
  issueLabels,
  preferredOfficialIds = [],
}: {
  jurisdictionName: string;
  issueLabels: string[];
  preferredOfficialIds?: string[];
}) {
  const officials = await getOfficials();
  const issueTokens = new Set(tokenize(issueLabels.join(" ")));

  return officials
    .map((official) => {
      const seededContact = seededOfficialContacts.find((entry) => entry.officialId === official.id);
      if (!seededContact) {
        return null;
      }

      const focusTokens = new Set(tokenize(seededContact.issueFocuses.join(" ")));
      let score = 0;

      if (preferredOfficialIds.includes(official.id)) {
        score += 12;
      }

      if (official.jurisdictionName === jurisdictionName) {
        score += 8;
      } else if (sharesState(official.jurisdictionName, jurisdictionName)) {
        score += 4;
      }

      for (const token of issueTokens) {
        if (focusTokens.has(token)) {
          score += 2;
        }
      }

      return {
        ...seededContact,
        score,
      };
    })
    .filter((entry): entry is (OfficialContactSummary & { issueFocuses: string[]; score: number }) => Boolean(entry))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score: _score, ...official }) => official);
}

export async function getContactOfficialsPanelData({
  entityId,
  entityType,
  contextTitle,
  contextSummary,
  jurisdictionName,
  issueLabels,
  userName,
  preferredOfficialIds = [],
}: {
  entityId: string;
  entityType: ContactActionTargetType;
  contextTitle: string;
  contextSummary: string;
  jurisdictionName: string;
  issueLabels: string[];
  userName: string;
  preferredOfficialIds?: string[];
}): Promise<ContactOfficialsPanelSummary> {
  const [officials, actions] = await Promise.all([
    getRelevantOfficialsForContact({ jurisdictionName, issueLabels, preferredOfficialIds }),
    getAllContactActions(),
  ]);
  const relevantActions = actions.filter((action) => action.entityId === entityId && action.entityType === entityType);
  const officialNameById = new Map(officials.map((official) => [official.officialId, official.name]));
  const compactSummary = contextSummary.length > 220 ? `${contextSummary.slice(0, 217).trimEnd()}...` : contextSummary;

  return {
    entityId,
    entityType,
    contextTitle,
    contextSummary,
    jurisdictionName,
    talkingPoints: [
      `Mention that you are reaching out about ${contextTitle} in ${jurisdictionName}.`,
      `Keep the request specific and constructive. Focus on the public impact rather than personal attacks.`,
      `Ask for a clear next step, such as public support, a response, or a meeting agenda item.`,
    ],
    defaultSubject: `Constituent message about ${contextTitle}`,
    defaultMessage: `Hello,\n\nI am reaching out about ${contextTitle} in ${jurisdictionName}.\n\n${compactSummary}\n\nI hope your office will review this issue and share what action or response is possible.\n\nThank you for your public service.\n\n${userName}`,
    officials,
    actionCount: relevantActions.length,
    recentActions: relevantActions.slice(0, 4).map((action) => ({
      userName: action.userName,
      officialName: officialNameById.get(action.officialId) ?? "this office",
      method: action.method,
      createdAt: action.createdAt,
    })),
  };
}

export function getContactActionActivityLabel(method: ContactMethod) {
  return methodLabel(method);
}
