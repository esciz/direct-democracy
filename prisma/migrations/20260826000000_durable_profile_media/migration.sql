-- Keep user-selected profile media attached to the durable account instead of
-- relying on the browser-only profile content cookie.

alter table "UserProfileContent"
  add column if not exists "profileImageUrl" text,
  add column if not exists "bannerImageUrl" text,
  add column if not exists "profileTheme" text not null default 'classic';
