create type "VoteResponseProvenance" as enum ('real_participant', 'qa_fixture', 'demo_seed', 'imported_test');

alter table "VoteResponse"
  add column "provenance" "VoteResponseProvenance" not null default 'real_participant',
  add column "countsInAnalytics" boolean not null default true,
  add column "provenanceNote" text;

create index "VoteResponse_provenance_idx" on "VoteResponse"("provenance");
create index "VoteResponse_countsInAnalytics_idx" on "VoteResponse"("countsInAnalytics");
