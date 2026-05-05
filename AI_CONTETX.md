# Direct Democracy - AI Context

## Product
Direct Democracy is a civic platform for verified voters, trusted citizens, candidates, and elected officials.

## Goal
Build a platform where citizens can follow officials, view posts, sign petitions, compare candidates, and see truth/follow-through scoring.

## Stack
- Next.js
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL

## Core user types
1. Citizen
- verified voter
- may remain anonymous in public-facing interactions
- can thumbs up/down posts
- can sign petitions

2. Trusted Citizen
- earns public posting ability after reaching threshold
- can post text, images, and video

3. Official
- verified elected official
- public profile
- public posting ability

4. Moderator/Admin
- moderation and scoring oversight

## Trusted Citizen threshold
A user becomes a Trusted Citizen when they reach either:
- 5% of verified users in a district
- or 10,000 followers
Whichever is less.

## Core posting rules
- Citizens: thumbs up/down only
- Trusted Citizens: can create public posts
- Officials: can create public posts
- All posts should support future truth scoring

## Petition rules
- Verified users can create petitions
- Verified users can sign petitions
- Petition signatures must be tied to the correct jurisdiction
- At 5,000 valid signatures in jurisdiction, petition becomes eligible for lawmaker co-sponsorship

## Truth Meter
Every post can have separate truth scores from:
- Media
- Moderators
- Citizens

## Follow-Through Meter
Officials can also have follow-through scoring based on statements/promises vs actual actions

## Development rules
- Build modularly
- Keep types strict
- Favor reusable components
- Do not over-engineer v1
- Use mock data and mock verification where real integrations are not ready
- Keep UI clean and modern
- Prioritize architecture that can scale later