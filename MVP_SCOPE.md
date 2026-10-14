# Direct Democracy – MVP Scope

## Who This Is For
Direct Democracy is built for real people:
- Citizens who are registered voters
- Citizens who want to become registered voters
- People who want clearer, more trustworthy information about candidates, policies, and decisions

This includes everyday voters who feel disconnected from the political process or unsure who to trust.

---

## Problem It Solves

### 1. Information Asymmetry
Voters lack clear, centralized, and trustworthy information about:
- candidates
- decisions
- policy impacts

### 2. Distorted Information Ecosystem
- fringe media and misinformation influence public perception
- voters struggle to distinguish signal from noise

### 3. Money in Politics
- campaign funding and donations influence decision-making
- lack of transparency makes it hard to connect money → decisions

---

## Core User Roles

### 1. Citizen
- Verified voter (or in process of verification)
- Default user type

### 2. Trusted Citizen
- Earned status based on reach and engagement
- Represents influential community voices

### 3. Official
- Verified elected official or candidate

### 4. Moderator/Admin
- Platform governance and integrity

Additional Capabilities:
- include a campaign donation link on profile
- receive support from citizens via external campaign pages

---

## Role Definitions & Permissions

### Citizen

Capabilities:
- create account
- verify voter status (mock in MVP)
- select jurisdiction (city/state/district)

Can:
- view feed of posts (officials + trusted citizens)
- thumbs up / thumbs down posts
- sign petitions
- follow officials
- view official profiles
- view petition details and signature counts

Cannot:
- create public posts
- comment or write content (MVP constraint)

---

### Trusted Citizen

Earned when:
- reaches 5% of district users OR 10,000 followers (whichever is lower)

Can:
- do everything a Citizen can
- create public posts (text initially)
- upload media (future: image/video)
- build a following

Represents:
- high-trust, high-visibility citizen contributors

---

### Candidate

A Candidate is a public-facing individual running for a specific office in a specific election.

A candidate may or may not currently hold office.

Candidates can:
- appear in the Elections tab
- have a public candidate profile
- display campaign bio, office sought, jurisdiction, party text, donation link, and website
- publish public posts if they have a claimed platform account

A candidate who currently holds office may also appear as an incumbent official.

---

### Official

Verified public figure:
- elected officials
- candidates

Can:
- create public posts
- maintain official profile
- communicate positions, updates, decisions
- receive engagement from citizens

Future:
- respond to flagged donation/decision correlations

---

### Moderator/Admin

Can:
- remove or flag inappropriate content
- manage users and roles
- oversee trust scoring inputs (future)
- maintain platform integrity

---

## Core Actions by Role

### Citizen Flow
- sign up → verify → select jurisdiction
- browse feed
- react to posts (thumbs up/down)
- sign petitions
- follow officials
- view profiles

---

### Trusted Citizen Flow
- create posts
- build followers
- participate in shaping narrative

---

### Official Flow
- publish updates
- share decisions
- engage indirectly via public visibility

---

### Petition Flow (All Verified Users)
- create petition
- sign petition
- view signature count
- track progress

Rule:
- At 5,000 verified signatures within a jurisdiction:
  → petition becomes eligible for co-sponsorship by officials

## Elections (MVP)

Purpose:
Give users a centralized place to understand upcoming elections and compare candidates.

MVP Features:

- Elections tab/page
- List of active/upcoming elections by jurisdiction

Each election includes:
- office (e.g., Governor, Mayor, Senate)
- election date
- list of candidates

Candidate Profiles Include:
- name
- party (plain text)
- jurisdiction
- short bio
- campaign donation link
- recent posts (if using platform)
- basic comparison view

Optional (MVP-light):
- simple polling data (manual or mocked)
- "leading / trailing" indicators (non-authoritative)

Not Included in MVP:
- real-time polling integrations
- complex analytics
- endorsements aggregation

---

## MVP Feature Set

Included:
- authentication (mock)
- user roles
- jurisdiction assignment
- feed
- role-based posting permissions
- petitions + signatures
- official profiles

Not Included (Post-MVP):
- truth meter scoring system
- follow-through scoring engine
- donation tracking + correlation
- legislation drafting
- advanced moderation systems
- real voter verification integrations

### Additional MVP Features

#### 1. Campaign Contributions (Basic MVP Version)

Purpose:
Provide transparent and direct access for users to financially support candidates and officials.

MVP Scope:
- Each Official/Candidate profile includes a "Donate" button
- Button links to an external campaign donation page (initial version)
- Display simple donation information:
  - total raised (manual or mocked)
  - top donor categories (optional placeholder)

Notes:
- Do NOT build full payment processing in MVP
- Do NOT store or process financial transactions initially
- Focus is on visibility and access, not infrastructure

Future Expansion:
- native donation processing
- donation tracking and correlation to decisions

---

## What Success Looks Like

Short-Term (MVP Success):
- users can understand and use the platform within minutes
- users engage with feed and petitions
- users clearly understand role differences
- platform demonstrates a new way to consume civic information

Long-Term Vision:
- more informed voters
- reduced influence of misinformation
- increased transparency between money, decisions, and outcomes
- more representative leaders in decision-making roles
- reduced reliance on corporate-influenced financing structures

---

## Guiding Principles

- simplicity over complexity for MVP
- clarity over completeness
- trust and transparency as core values
- build for real-world behavior, not ideal behavior
- design for scale, but implement lean