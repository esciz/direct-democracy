import { RaceGroupPage } from "@/app/elections/race-group-page";

export const dynamic = "force-dynamic";

export default function FederalRacesPage() {
  return (
    <RaceGroupPage
      eyebrow="Federal Races"
      title="Nevada federal election records"
      description="Imported federal races and federal-office contests appearing in Nevada election data."
      filter={(election) => /president|u\.s\.|federal/i.test(`${election.title} ${election.officeTitle}`)}
    />
  );
}
