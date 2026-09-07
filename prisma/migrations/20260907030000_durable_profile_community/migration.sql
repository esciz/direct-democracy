-- A selected civic view is a preference, separate from verified jurisdiction.
alter table "UserProfileContent"
  add column if not exists "primaryCommunityId" text;
