import { RaceGroupPage } from "@/app/elections/race-group-page";

export const dynamic = "force-dynamic";

export default function LocalRacesPage() {
  return (
    <RaceGroupPage
      eyebrow="County & Local Races"
      title="Nevada county and local elections"
      description="Imported county, city, and local election records for the Nevada beta."
      filter={(election) => /county|city|reno|carson|local|municipal/i.test(`${election.title} ${election.officeTitle} ${election.jurisdictionName}`)}
    />
  );
}
