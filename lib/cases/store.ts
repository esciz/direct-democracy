import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import { canonicalizeIssueTags } from "@/lib/issues/utils";
import type {
  AuthUser,
  CaseDetail,
  CaseSummary,
  CommunityBriefThemeSummary,
  SupportStatementSummary,
} from "@/types/domain";

const CASE_FOLLOWS_COOKIE = "dd_case_follows";
const REMOVED_CASE_FOLLOWS_COOKIE = "dd_removed_case_follows";
const CASE_SUPPORT_STATEMENTS_COOKIE = "dd_case_support_statements";
const CASE_BRIEF_THEMES_COOKIE = "dd_case_brief_themes";
const CASE_BRIEF_THEME_SUPPORTS_COOKIE = "dd_case_brief_theme_supports";
const REMOVED_CASE_BRIEF_THEME_SUPPORTS_COOKIE = "dd_removed_case_brief_theme_supports";

const seededCasesBase = [
  {
    id: "case_carson_meeting_access",
    title: "Carson City Open Meetings Access Challenge",
    summary:
      "A public-interest case challenging whether major Carson City boards can continue holding key public meetings without consistent livestreaming, archived recordings, and timely public access to meeting materials.",
    courtLevel: "state",
    stage: "appeal",
    jurisdictionId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    issueTags: ["Government transparency", "Public meeting access", "Civic participation"],
    keyDates: [
      { label: "Appeal filed", date: "2026-02-18" },
      { label: "Community interest hearing", date: "2026-04-17" },
    ],
    status: "active",
    createdAt: "2026-03-10T12:00:00.000Z",
  },
  {
    id: "case_public_lands_notice",
    title: "Western Public Lands Notice and Access Case",
    summary:
      "A federal appellate case about whether public agencies gave adequate notice and community access before a major land-use decision affecting recreation access, environmental review, and nearby local economies.",
    courtLevel: "federal",
    stage: "merits",
    jurisdictionId: "united-states",
    jurisdictionName: "United States",
    issueTags: ["Environment / land use", "Government transparency", "Economic development"],
    keyDates: [
      { label: "Merits briefing opens", date: "2026-04-22" },
      { label: "Argument window", date: "2026-06-14" },
    ],
    status: "active",
    createdAt: "2026-03-14T09:30:00.000Z",
  },
] satisfies Array<Omit<CaseSummary, "followCount" | "supportCount" | "viewerIsFollowing" | "viewerSupports">>;

type CaseFollowSeed = {
  id: string;
  caseId: string;
  userId: string;
  createdAt: string;
};

type CommunityBriefThemeSupportSeed = {
  id: string;
  themeId: string;
  userId: string;
  createdAt: string;
};

const seededCaseFollows: CaseFollowSeed[] = [
  { id: "case_follow_alicia_meeting", caseId: "case_carson_meeting_access", userId: "user_citizen_alicia_hart", createdAt: "2026-03-20T11:00:00.000Z" },
  { id: "case_follow_marco_meeting", caseId: "case_carson_meeting_access", userId: "user_trusted_citizen_marco_silva", createdAt: "2026-03-20T11:10:00.000Z" },
  { id: "case_follow_hannah_lands", caseId: "case_public_lands_notice", userId: "user_trusted_citizen_hannah_cho", createdAt: "2026-03-21T09:00:00.000Z" },
  { id: "case_follow_tiana_lands", caseId: "case_public_lands_notice", userId: "user_citizen_tiana_moore", createdAt: "2026-03-22T14:00:00.000Z" },
];

const seededSupportStatements: SupportStatementSummary[] = [
  {
    id: "case_statement_alicia_meeting",
    caseId: "case_carson_meeting_access",
    userId: "user_citizen_alicia_hart",
    userName: "Alicia Hart",
    statement:
      "Residents should be able to follow major Carson City decisions even when work schedules or childcare make in-person attendance hard.",
    createdAt: "2026-03-22T10:00:00.000Z",
    isPublic: true,
  },
  {
    id: "case_statement_marco_meeting",
    caseId: "case_carson_meeting_access",
    userId: "user_trusted_citizen_marco_silva",
    userName: "Marco Silva",
    statement:
      "Clear archives and meeting access matter because public oversight only works when people can actually see what happened and what documents were used.",
    createdAt: "2026-03-23T09:30:00.000Z",
    isPublic: true,
  },
  {
    id: "case_statement_hannah_lands",
    caseId: "case_public_lands_notice",
    userId: "user_trusted_citizen_hannah_cho",
    userName: "Hannah Cho",
    statement:
      "Communities should get understandable notice before land-use decisions reshape outdoor access, traffic, and local economic patterns.",
    createdAt: "2026-03-24T08:20:00.000Z",
    isPublic: true,
  },
];

const seededBriefThemesBase: Omit<CommunityBriefThemeSummary, "supportCount" | "viewerSupports">[] = [
  {
    id: "brief_theme_meeting_archives",
    caseId: "case_carson_meeting_access",
    creatorUserId: "user_trusted_citizen_marco_silva",
    creatorName: "Marco Silva",
    title: "Public access should not depend on physical attendance",
    description:
      "Emphasize the community impact when meeting access depends on work flexibility, transportation, or caregiving rather than equal public access tools.",
    createdAt: "2026-03-23T12:00:00.000Z",
  },
  {
    id: "brief_theme_meeting_records",
    caseId: "case_carson_meeting_access",
    creatorUserId: "user_trusted_citizen_marco_silva",
    creatorName: "Marco Silva",
    title: "Archive reliability shapes trust in local decisions",
    description:
      "Focus on how incomplete archives and late packets make it harder for residents to understand decisions and hold institutions accountable.",
    createdAt: "2026-03-24T14:15:00.000Z",
  },
  {
    id: "brief_theme_lands_notice",
    caseId: "case_public_lands_notice",
    creatorUserId: "user_trusted_citizen_hannah_cho",
    creatorName: "Hannah Cho",
    title: "Notice quality affects real community participation",
    description:
      "Highlight how technical or late notice can exclude ordinary people from land-use decisions with long-term effects on access and local economies.",
    createdAt: "2026-03-25T09:10:00.000Z",
  },
];

const seededBriefThemeSupports: CommunityBriefThemeSupportSeed[] = [
  { id: "theme_support_1", themeId: "brief_theme_meeting_archives", userId: "user_citizen_alicia_hart", createdAt: "2026-03-24T10:00:00.000Z" },
  { id: "theme_support_2", themeId: "brief_theme_meeting_archives", userId: "user_candidate_owen_castillo", createdAt: "2026-03-24T12:00:00.000Z" },
  { id: "theme_support_3", themeId: "brief_theme_meeting_records", userId: "user_official_elena_ramirez", createdAt: "2026-03-24T16:10:00.000Z" },
  { id: "theme_support_4", themeId: "brief_theme_lands_notice", userId: "user_citizen_tiana_moore", createdAt: "2026-03-26T09:00:00.000Z" },
  { id: "theme_support_5", themeId: "brief_theme_lands_notice", userId: "user_trusted_citizen_hannah_cho", createdAt: "2026-03-26T09:15:00.000Z" },
];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isCaseFollow(value: unknown): value is CaseFollowSeed {
  if (!value || typeof value !== "object") {
    return false;
  }
  const follow = value as Record<string, unknown>;
  return isString(follow.id) && isString(follow.caseId) && isString(follow.userId) && isString(follow.createdAt);
}

function isSupportStatement(value: unknown): value is SupportStatementSummary {
  if (!value || typeof value !== "object") {
    return false;
  }
  const statement = value as Record<string, unknown>;
  return (
    isString(statement.id) &&
    isString(statement.caseId) &&
    isString(statement.userId) &&
    isString(statement.userName) &&
    isString(statement.statement) &&
    isString(statement.createdAt) &&
    typeof statement.isPublic === "boolean"
  );
}

function isBriefTheme(value: unknown): value is Omit<CommunityBriefThemeSummary, "supportCount" | "viewerSupports"> {
  if (!value || typeof value !== "object") {
    return false;
  }
  const theme = value as Record<string, unknown>;
  return (
    isString(theme.id) &&
    isString(theme.caseId) &&
    isString(theme.creatorUserId) &&
    isString(theme.creatorName) &&
    isString(theme.title) &&
    isString(theme.description) &&
    isString(theme.createdAt)
  );
}

function isThemeSupport(value: unknown): value is CommunityBriefThemeSupportSeed {
  if (!value || typeof value !== "object") {
    return false;
  }
  const support = value as Record<string, unknown>;
  return isString(support.id) && isString(support.themeId) && isString(support.userId) && isString(support.createdAt);
}

async function readCookieArray<T>(cookieName: string, guard: (value: unknown) => value is T): Promise<T[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(cookieName)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

async function writeCookieArray<T>(cookieName: string, data: T[]) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, JSON.stringify(data), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getStoredCaseFollows() {
  return readCookieArray(CASE_FOLLOWS_COOKIE, isCaseFollow);
}

export async function setStoredCaseFollows(entries: CaseFollowSeed[]) {
  await writeCookieArray(CASE_FOLLOWS_COOKIE, entries.slice(0, 200));
}

export async function getRemovedCaseFollowKeys() {
  return readCookieArray(REMOVED_CASE_FOLLOWS_COOKIE, isString);
}

export async function setRemovedCaseFollowKeys(keys: string[]) {
  await writeCookieArray(REMOVED_CASE_FOLLOWS_COOKIE, keys.slice(0, 200));
}

export async function getStoredSupportStatements() {
  return readCookieArray(CASE_SUPPORT_STATEMENTS_COOKIE, isSupportStatement);
}

export async function setStoredSupportStatements(entries: SupportStatementSummary[]) {
  await writeCookieArray(CASE_SUPPORT_STATEMENTS_COOKIE, entries.slice(0, 200));
}

export async function getStoredBriefThemes() {
  return readCookieArray(CASE_BRIEF_THEMES_COOKIE, isBriefTheme);
}

export async function setStoredBriefThemes(entries: Array<Omit<CommunityBriefThemeSummary, "supportCount" | "viewerSupports">>) {
  await writeCookieArray(CASE_BRIEF_THEMES_COOKIE, entries.slice(0, 120));
}

export async function getStoredBriefThemeSupports() {
  return readCookieArray(CASE_BRIEF_THEME_SUPPORTS_COOKIE, isThemeSupport);
}

export async function setStoredBriefThemeSupports(entries: CommunityBriefThemeSupportSeed[]) {
  await writeCookieArray(CASE_BRIEF_THEME_SUPPORTS_COOKIE, entries.slice(0, 240));
}

export async function getRemovedBriefThemeSupportKeys() {
  return readCookieArray(REMOVED_CASE_BRIEF_THEME_SUPPORTS_COOKIE, isString);
}

export async function setRemovedBriefThemeSupportKeys(keys: string[]) {
  await writeCookieArray(REMOVED_CASE_BRIEF_THEME_SUPPORTS_COOKIE, keys.slice(0, 240));
}

async function getAllCaseFollows() {
  const removed = new Set(await getRemovedCaseFollowKeys());
  const merged = new Map<string, CaseFollowSeed>();

  for (const follow of seededCaseFollows) {
    const key = `${follow.caseId}:${follow.userId}`;
    if (!removed.has(key)) {
      merged.set(key, follow);
    }
  }

  for (const follow of await getStoredCaseFollows()) {
    merged.set(`${follow.caseId}:${follow.userId}`, follow);
  }

  return [...merged.values()];
}

async function getAllSupportStatements() {
  const merged = new Map<string, SupportStatementSummary>();

  for (const statement of seededSupportStatements) {
    merged.set(`${statement.caseId}:${statement.userId}`, statement);
  }

  for (const statement of await getStoredSupportStatements()) {
    merged.set(`${statement.caseId}:${statement.userId}`, statement);
  }

  return [...merged.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getPublicCaseContributionsForUser(userId: string) {
  const [statements, cases] = await Promise.all([getAllSupportStatements(), getAllCases()]);

  return statements
    .filter((statement) => statement.userId === userId && statement.isPublic)
    .map((statement) => {
      const relatedCase = cases.find((entry) => entry.id === statement.caseId);

      return {
        ...statement,
        caseTitle: relatedCase?.title ?? "Public-interest case",
        caseHref: relatedCase ? `/cases/${relatedCase.id}` : "/cases",
      };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function getAllBriefThemes(viewerId?: string) {
  const [storedThemes, allSupports] = await Promise.all([getStoredBriefThemes(), getAllBriefThemeSupports()]);
  const mergedThemes = [...seededBriefThemesBase, ...storedThemes];

  return mergedThemes
    .map((theme) => {
      const supportCount = allSupports.filter((support) => support.themeId === theme.id).length;
      return {
        ...theme,
        supportCount,
        viewerSupports: viewerId ? allSupports.some((support) => support.themeId === theme.id && support.userId === viewerId) : false,
      } satisfies CommunityBriefThemeSummary;
    })
    .sort((a, b) => {
      if (b.supportCount !== a.supportCount) {
        return b.supportCount - a.supportCount;
      }
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
}

async function getAllBriefThemeSupports() {
  const removed = new Set(await getRemovedBriefThemeSupportKeys());
  const merged = new Map<string, CommunityBriefThemeSupportSeed>();

  for (const support of seededBriefThemeSupports) {
    const key = `${support.themeId}:${support.userId}`;
    if (!removed.has(key)) {
      merged.set(key, support);
    }
  }

  for (const support of await getStoredBriefThemeSupports()) {
    merged.set(`${support.themeId}:${support.userId}`, support);
  }

  return [...merged.values()];
}

export async function getAllCases(viewer?: AuthUser): Promise<CaseSummary[]> {
  const [follows, supportStatements] = await Promise.all([getAllCaseFollows(), getAllSupportStatements()]);

  return seededCasesBase
    .map((entry) => ({
      ...entry,
      issueTags: canonicalizeIssueTags(entry.issueTags),
      followCount: follows.filter((follow) => follow.caseId === entry.id).length,
      supportCount: supportStatements.filter((statement) => statement.caseId === entry.id).length,
      viewerIsFollowing: viewer ? follows.some((follow) => follow.caseId === entry.id && follow.userId === viewer.id) : false,
      viewerSupports: viewer ? supportStatements.some((statement) => statement.caseId === entry.id && statement.userId === viewer.id) : false,
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getCaseById(caseId: string, viewer?: AuthUser): Promise<CaseDetail | null> {
  const [cases, statements, themes] = await Promise.all([getAllCases(viewer), getAllSupportStatements(), getAllBriefThemes(viewer?.id)]);
  const caseSummary = cases.find((entry) => entry.id === caseId);

  if (!caseSummary) {
    return null;
  }

  return {
    ...caseSummary,
    supportStatements: statements.filter((statement) => statement.caseId === caseId && statement.isPublic).slice(0, 8),
    communityBriefThemes: themes.filter((theme) => theme.caseId === caseId).slice(0, 6),
  };
}

export function getCaseSupportStatementAuthorName(userId: string) {
  return seedUsers.find((user) => user.id === userId)?.name ?? "Community user";
}
