import type { Metadata } from "next";

import { ChallengeMyViewExplorer } from "./challenge-my-view-explorer";

export const metadata: Metadata = {
  title: "Challenge My View | Direct Democracy",
  description: "Explore the strongest challenge to a political position, its evidence, values, tradeoffs, and possible common ground.",
};

export default function ChallengeMyViewPage() {
  return <ChallengeMyViewExplorer />;
}
