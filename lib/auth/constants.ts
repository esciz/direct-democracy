import type { UserRole } from "@/types/domain";

export const MOCK_AUTH_COOKIE = "dd_session_user";
export const PUBLIC_SESSION_VALUE = "__public__";
export const GUEST_BROWSE_USER_ID = "user_guest_browse";
export const NEW_USER_DEMO_ID = "user_citizen_casey_rivera";

const demoModeEnv = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE ?? process.env.ENABLE_DEMO_MODE;

export const DEV_ONLY_AUTH_ENABLED = demoModeEnv === "true";
export const DEMO_PROFILE_SWITCHER_ENABLED = demoModeEnv === "true";
export const PUBLIC_DEMO_DATA_ENABLED = demoModeEnv === "true";

export const PUBLIC_POST_CREATOR_ROLES: UserRole[] = ["trustedCitizen", "candidate", "official", "media"];

export const ROLE_LABELS: Record<UserRole, string> = {
  citizen: "Citizen",
  trustedCitizen: "Trusted Citizen",
  candidate: "Candidate",
  official: "Official",
  media: "Media",
  moderator: "Moderator",
  admin: "Admin",
  public_user: "Public User",
  verified_resident: "Verified Resident",
  platform_admin: "Platform Admin",
  government_admin: "Government Admin",
  government_staff: "Government Staff",
  government_observer: "Government Observer",
};
