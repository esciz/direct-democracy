import type { Metadata } from "next";

import { listRootMapSuggestions } from "@/lib/root-map/suggestions";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

import { RootStrikerMap } from "./root-striker-map";

export const metadata: Metadata = {
  title: "Root Striker Lab | Direct Democracy",
  description: "An experimental civic root-cause map.",
};

type RootStrikerLabPageProps = {
  searchParams?: Promise<{ suggestion?: string }>;
};

export default async function RootStrikerLabPage({ searchParams }: RootStrikerLabPageProps) {
  const [approvedSuggestions, currentUser, params] = await Promise.all([
    listRootMapSuggestions("approved"),
    getCurrentSessionUser(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const suggestionState = params?.suggestion === "submitted" || params?.suggestion === "error" ? params.suggestion : undefined;

  return <RootStrikerMap approvedSuggestions={approvedSuggestions} canSuggest={Boolean(currentUser)} suggestionState={suggestionState} />;
}
