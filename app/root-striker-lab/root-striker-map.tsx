"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  CircleDollarSign,
  Crosshair,
  FileText,
  Filter,
  Focus,
  Info,
  Lightbulb,
  MessageSquare,
  Minus,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Vote,
  X,
} from "lucide-react";
import { PointerEvent as ReactPointerEvent, WheelEvent, useMemo, useRef, useState } from "react";

import styles from "./root-striker.module.css";
import { submitRootMapSuggestion } from "./actions";
import type { RootMapSuggestion } from "@/lib/root-map/suggestions";

type NodeKind = "root" | "system" | "issue" | "outcome" | "lever";

type GraphNode = {
  id: string;
  label: string;
  shortLabel?: string;
  kind: NodeKind;
  x: number;
  y: number;
  size: number;
  eyebrow: string;
  summary: string;
  rootScore: number;
  communityAdded?: boolean;
  viewpoints: {
    public: string;
    democratic: string;
    republican: string;
    industry: string;
  };
};

type GraphEdge = {
  from: string;
  to: string;
  label: string;
};

type ViewBox = { x: number; y: number; width: number; height: number };

const INITIAL_VIEW_BOX: ViewBox = { x: 0, y: 0, width: 1500, height: 950 };

const NODES: GraphNode[] = [
  {
    id: "money-politics",
    label: "Money in politics",
    shortLabel: "Money in\npolitics",
    kind: "root",
    x: 600,
    y: 368,
    size: 82,
    eyebrow: "Primary root hypothesis",
    summary: "Concentrated political spending can shape access, agendas, policy design, and which public demands become government action.",
    rootScore: 96,
    viewpoints: {
      public: "Broad concern about corruption and unequal influence.",
      democratic: "Often emphasizes disclosure, public financing, and contribution limits.",
      republican: "Often emphasizes speech protections, disclosure, and limiting government power.",
      industry: "Often argues organized participation provides expertise and representation.",
    },
  },
  {
    id: "campaign-finance",
    label: "Campaign finance",
    kind: "system",
    x: 600,
    y: 126,
    size: 58,
    eyebrow: "Political system",
    summary: "The rules and funding channels that determine who can finance campaigns, how much they can give, and what voters can see.",
    rootScore: 92,
    viewpoints: {
      public: "High interest in transparency and reducing donor influence.",
      democratic: "Reform coalitions commonly support tighter limits and public financing.",
      republican: "Reform views vary, with stronger concern about political speech restrictions.",
      industry: "Political organizations generally favor predictable rules and broad participation rights.",
    },
  },
  {
    id: "lobbying-access",
    label: "Lobbying & access",
    kind: "system",
    x: 392,
    y: 246,
    size: 53,
    eyebrow: "Influence pathway",
    summary: "Well-resourced interests can sustain relationships, provide policy language, and receive attention that diffuse public interests struggle to match.",
    rootScore: 90,
    viewpoints: {
      public: "Often viewed as necessary expertise with an unequal-access problem.",
      democratic: "Typically favors disclosure and restrictions around conflicts of interest.",
      republican: "Often favors transparency while warning against restricting petition rights.",
      industry: "Frames lobbying as issue education and representation for members.",
    },
  },
  {
    id: "concentrated-wealth",
    label: "Concentrated wealth",
    kind: "system",
    x: 810,
    y: 238,
    size: 56,
    eyebrow: "Economic feedback loop",
    summary: "When wealth is highly concentrated, a small set of actors can devote far more resources to political influence and agenda setting.",
    rootScore: 94,
    viewpoints: {
      public: "Concern centers on fairness, mobility, and whether the economy rewards work.",
      democratic: "Often stresses progressive taxation and stronger worker power.",
      republican: "Often stresses growth, entrepreneurship, and avoiding punitive taxation.",
      industry: "Often argues capital formation and investment produce broad benefits.",
    },
  },
  {
    id: "revolving-door",
    label: "Revolving door",
    kind: "system",
    x: 824,
    y: 424,
    size: 48,
    eyebrow: "Institutional incentive",
    summary: "Movement between government and regulated industries can transfer expertise while creating real or perceived conflicts of interest.",
    rootScore: 81,
    viewpoints: {
      public: "Strong concern about conflicts and regulators serving future employers.",
      democratic: "Often supports cooling-off periods and stronger ethics rules.",
      republican: "Often supports ethics rules while valuing private-sector expertise.",
      industry: "Emphasizes the need for people who understand complex sectors.",
    },
  },
  {
    id: "electoral-incentives",
    label: "Electoral incentives",
    kind: "system",
    x: 622,
    y: 596,
    size: 52,
    eyebrow: "Political system",
    summary: "Primary elections, district design, turnout, media attention, and fundraising can reward positions that differ from broad public preferences.",
    rootScore: 89,
    viewpoints: {
      public: "Voters commonly want more choice and less performative conflict.",
      democratic: "Reform proposals include voting access, redistricting, and public financing.",
      republican: "Reform proposals emphasize election confidence, local control, and competition.",
      industry: "Political professionals often defend existing systems as stable and familiar.",
    },
  },
  {
    id: "public-voice",
    label: "Public voice gap",
    kind: "outcome",
    x: 378,
    y: 484,
    size: 52,
    eyebrow: "Democratic outcome",
    summary: "A gap appears when widely held public priorities repeatedly fail to become policy or receive meaningful consideration.",
    rootScore: 86,
    viewpoints: {
      public: "People want visible proof that participation changes decisions.",
      democratic: "Often connects the gap to access, representation, and structural barriers.",
      republican: "Often connects the gap to bureaucracy, centralization, and unaccountable institutions.",
      industry: "May argue public opinion does not capture technical constraints or tradeoffs.",
    },
  },
  {
    id: "food-land",
    label: "Food & land",
    kind: "issue",
    x: 180,
    y: 170,
    size: 62,
    eyebrow: "Issue system",
    summary: "Food production ties farm economics to soil, water, climate, nutrition, rural communities, and public health.",
    rootScore: 78,
    viewpoints: {
      public: "Shared priorities include affordable food, healthy communities, and stable farms.",
      democratic: "Often emphasizes conservation incentives, climate resilience, and nutrition.",
      republican: "Often emphasizes farm autonomy, productivity, and voluntary stewardship.",
      industry: "Often prioritizes scale, yield, supply reliability, and workable transitions.",
    },
  },
  {
    id: "regenerative-ag",
    label: "Regenerative agriculture",
    shortLabel: "Regenerative\nagriculture",
    kind: "lever",
    x: 174,
    y: 350,
    size: 54,
    eyebrow: "Potential leverage point",
    summary: "A family of farming practices intended to rebuild soil, improve water cycles, support biodiversity, and increase resilience.",
    rootScore: 74,
    viewpoints: {
      public: "Appeals across parties when framed around soil, farmer resilience, and local health.",
      democratic: "Often links adoption to climate and conservation programs.",
      republican: "Often favors voluntary, producer-led practices over mandates.",
      industry: "Support varies with cost, measurement, supply-chain demand, and transition risk.",
    },
  },
  {
    id: "soil-water",
    label: "Soil & water health",
    kind: "outcome",
    x: 72,
    y: 70,
    size: 43,
    eyebrow: "Downstream outcome",
    summary: "Soil structure and nutrient management affect erosion, water retention, runoff, and downstream drinking-water systems.",
    rootScore: 65,
    viewpoints: {
      public: "Clean water and productive soil generally draw broad support.",
      democratic: "Often supports standards alongside conservation funding.",
      republican: "Often favors local stewardship and incentive-based adoption.",
      industry: "Focuses on measurable results without unworkable compliance costs.",
    },
  },
  {
    id: "healthcare",
    label: "Healthcare costs",
    kind: "issue",
    x: 1025,
    y: 116,
    size: 64,
    eyebrow: "Issue system",
    summary: "Medical prices reflect insurance design, provider concentration, drug policy, administrative complexity, and population health.",
    rootScore: 84,
    viewpoints: {
      public: "Broad agreement that costs are too high; disagreement centers on the remedy.",
      democratic: "Often favors stronger public bargaining and expanded coverage.",
      republican: "Often favors competition, transparency, choice, and deregulation.",
      industry: "Emphasizes innovation, workforce costs, risk, and system complexity.",
    },
  },
  {
    id: "drug-pricing",
    label: "Drug pricing & patents",
    kind: "lever",
    x: 1060,
    y: 290,
    size: 52,
    eyebrow: "Policy leverage point",
    summary: "Patent exclusivity, negotiation rules, intermediaries, and market competition jointly influence what patients and governments pay.",
    rootScore: 79,
    viewpoints: {
      public: "Strong concern about affordability and opaque pricing.",
      democratic: "Often favors negotiation, caps, and faster generic competition.",
      republican: "Often favors transparency, competition, and reforming intermediaries.",
      industry: "Argues revenue supports research, risk-taking, and future treatments.",
    },
  },
  {
    id: "chronic-disease",
    label: "Chronic disease",
    kind: "outcome",
    x: 920,
    y: 346,
    size: 45,
    eyebrow: "Downstream outcome",
    summary: "Long-term disease burden reflects healthcare access, food environments, pollution, income, stress, and individual behavior.",
    rootScore: 70,
    viewpoints: {
      public: "Shared interest in prevention, affordability, and healthier communities.",
      democratic: "Often emphasizes social determinants and public-health investment.",
      republican: "Often emphasizes choice, local institutions, and personal agency.",
      industry: "Supports prevention while operating within reimbursement and market incentives.",
    },
  },
  {
    id: "housing",
    label: "Housing affordability",
    kind: "issue",
    x: 1056,
    y: 548,
    size: 64,
    eyebrow: "Issue system",
    summary: "Housing costs emerge from land-use rules, permitting, construction capacity, financing, taxes, population growth, and local political power.",
    rootScore: 82,
    viewpoints: {
      public: "Renters and prospective buyers want lower costs; incumbent owners may resist change.",
      democratic: "Often combines tenant support, subsidies, and zoning reform.",
      republican: "Often emphasizes supply, deregulation, property rights, and local control.",
      industry: "Prioritizes predictable approvals, financing, and buildable projects.",
    },
  },
  {
    id: "zoning-supply",
    label: "Zoning & supply",
    kind: "lever",
    x: 1048,
    y: 706,
    size: 48,
    eyebrow: "Policy leverage point",
    summary: "Local rules determine where and what can be built, while infrastructure, labor, interest rates, and materials constrain actual production.",
    rootScore: 76,
    viewpoints: {
      public: "People favor affordability but often disagree about neighborhood change.",
      democratic: "Views range from tenant protection to aggressive supply reform.",
      republican: "Views range from local control to broad regulatory reform.",
      industry: "Generally favors faster approvals and fewer construction constraints.",
    },
  },
  {
    id: "wealth-tax",
    label: "Wealth & taxation",
    kind: "issue",
    x: 800,
    y: 700,
    size: 61,
    eyebrow: "Issue system",
    summary: "Tax treatment, asset ownership, market power, wages, and inheritance shape who accumulates wealth and who funds public needs.",
    rootScore: 88,
    viewpoints: {
      public: "People want a system perceived as fair without harming opportunity.",
      democratic: "Often favors more progressive taxes and stronger enforcement.",
      republican: "Often favors lower rates, investment incentives, and simpler rules.",
      industry: "Often warns that higher taxes can reduce investment or shift capital.",
    },
  },
  {
    id: "tax-code",
    label: "Tax-code design",
    kind: "lever",
    x: 896,
    y: 594,
    size: 45,
    eyebrow: "Policy leverage point",
    summary: "Deductions, rates, enforcement, and the treatment of labor versus assets distribute burdens and incentives across the economy.",
    rootScore: 85,
    viewpoints: {
      public: "Complexity and perceived loopholes undermine trust.",
      democratic: "Often seeks higher effective rates on wealth and top incomes.",
      republican: "Often seeks lower rates, simpler rules, and growth incentives.",
      industry: "Seeks stability and provisions favorable to investment and competitiveness.",
    },
  },
  {
    id: "climate-energy",
    label: "Climate & energy",
    kind: "issue",
    x: 164,
    y: 648,
    size: 63,
    eyebrow: "Issue system",
    summary: "Energy production, transportation, buildings, land use, and agriculture connect emissions to health, prices, jobs, and security.",
    rootScore: 83,
    viewpoints: {
      public: "People value reliable, affordable energy and protection from pollution and disasters.",
      democratic: "Often supports faster clean-energy deployment and emissions standards.",
      republican: "Often prioritizes reliability, domestic production, and technology neutrality.",
      industry: "Positions vary by sector, asset mix, incentives, and transition exposure.",
    },
  },
  {
    id: "energy-incentives",
    label: "Energy incentives",
    kind: "lever",
    x: 304,
    y: 638,
    size: 46,
    eyebrow: "Policy leverage point",
    summary: "Subsidies, tax credits, permitting, utility rules, and public investment influence which energy systems get built and maintained.",
    rootScore: 80,
    viewpoints: {
      public: "Support depends heavily on price, reliability, jobs, and local effects.",
      democratic: "Often favors clean-energy incentives and public investment.",
      republican: "Often favors broad production, faster permitting, and fewer mandates.",
      industry: "Each sector tends to defend favorable incentives and infrastructure.",
    },
  },
  {
    id: "pollution-health",
    label: "Pollution & health",
    kind: "outcome",
    x: 66,
    y: 490,
    size: 45,
    eyebrow: "Shared downstream outcome",
    summary: "Air, water, and soil pollution connect energy, transportation, industry, and agriculture to healthcare costs and unequal community burdens.",
    rootScore: 72,
    viewpoints: {
      public: "Clean air and water draw broad support; costs and enforcement divide opinion.",
      democratic: "Often favors stronger standards and environmental-justice protections.",
      republican: "Often favors state-led enforcement and cost-sensitive regulation.",
      industry: "Emphasizes achievable standards, timelines, and technological feasibility.",
    },
  },
  {
    id: "abortion-rights",
    label: "Abortion & reproductive rights",
    shortLabel: "Abortion &\nreproductive rights",
    kind: "issue",
    x: 1235,
    y: 88,
    size: 58,
    eyebrow: "National wedge issue",
    summary: "A conflict over bodily autonomy, fetal life, medical care, state authority, religious conviction, privacy, and who gets final decision-making power.",
    rootScore: 76,
    viewpoints: {
      public: "Opinion varies by stage of pregnancy, circumstance, and the specific restriction or protection proposed.",
      democratic: "Generally emphasizes legal access, privacy, contraception, and clinician judgment.",
      republican: "Generally emphasizes fetal life, state authority, parental involvement, and limits on abortion.",
      industry: "Healthcare institutions focus on legal clarity, emergency-care rules, liability, and clinician recruitment.",
    },
  },
  {
    id: "immigration-border",
    label: "Immigration & the border",
    shortLabel: "Immigration &\nthe border",
    kind: "issue",
    x: 1390,
    y: 214,
    size: 60,
    eyebrow: "National wedge issue",
    summary: "Border enforcement, legal immigration, asylum, labor demand, citizenship, local services, family unity, and national identity converge here.",
    rootScore: 82,
    viewpoints: {
      public: "Many voters simultaneously support border control and lawful pathways, while disagreeing sharply on enforcement methods.",
      democratic: "Often combines legal pathways and humanitarian protections with targeted enforcement.",
      republican: "Often prioritizes detention, removal, border enforcement, and narrower eligibility.",
      industry: "Agriculture, construction, technology, and hospitality often emphasize stable labor and visa access.",
    },
  },
  {
    id: "foreign-policy-war",
    label: "Foreign policy & war",
    kind: "issue",
    x: 1402,
    y: 392,
    size: 57,
    eyebrow: "National wedge issue",
    summary: "Military aid, alliances, war powers, defense spending, trade routes, energy security, and domestic priorities compete for attention and resources.",
    rootScore: 77,
    viewpoints: {
      public: "Support often depends on the conflict, perceived threat, cost, duration, and burden-sharing.",
      democratic: "Often stresses alliances, diplomacy, democracy support, and multilateral coordination.",
      republican: "Views range from muscular deterrence to restraint and tighter conditions on foreign aid.",
      industry: "Defense, energy, logistics, and technology sectors have distinct stakes in security policy.",
    },
  },
  {
    id: "gun-policy",
    label: "Gun rights & violence",
    kind: "issue",
    x: 1342,
    y: 566,
    size: 59,
    eyebrow: "National wedge issue",
    summary: "Constitutional rights, self-defense, suicide, community violence, mass shootings, trafficking, enforcement, and prevention shape the divide.",
    rootScore: 79,
    viewpoints: {
      public: "Specific policies can attract broader support than the parties’ overall gun-policy brands suggest.",
      democratic: "Generally favors background checks, safe-storage rules, and restrictions on some weapons.",
      republican: "Generally emphasizes Second Amendment rights, self-defense, enforcement, and mental health.",
      industry: "Firearm groups defend access and liability protections; healthcare groups emphasize preventable injury.",
    },
  },
  {
    id: "cost-living",
    label: "Cost of living & inflation",
    shortLabel: "Cost of living\n& inflation",
    kind: "issue",
    x: 1245,
    y: 744,
    size: 61,
    eyebrow: "Top national concern",
    summary: "Housing, food, healthcare, energy, wages, interest rates, taxes, tariffs, market concentration, and supply constraints combine into household affordability.",
    rootScore: 87,
    viewpoints: {
      public: "Affordability crosses party lines, though voters assign responsibility very differently.",
      democratic: "Often emphasizes competition policy, targeted subsidies, wages, and consumer protections.",
      republican: "Often emphasizes taxes, regulation, domestic production, spending restraint, and interest rates.",
      industry: "Businesses point to labor, financing, regulation, materials, energy, and supply-chain costs.",
    },
  },
  {
    id: "speech-platforms",
    label: "Free speech & platform power",
    shortLabel: "Free speech &\nplatform power",
    kind: "issue",
    x: 1040,
    y: 876,
    size: 55,
    eyebrow: "National wedge issue",
    summary: "Government pressure, private moderation, misinformation, algorithmic reach, protest, campus speech, and concentrated media power collide online and offline.",
    rootScore: 75,
    viewpoints: {
      public: "People value open expression while disagreeing over harassment, falsehoods, and institutional power.",
      democratic: "Often presses platforms to address harmful content while defending protest and civil liberties.",
      republican: "Often focuses on perceived viewpoint censorship and government-platform coordination.",
      industry: "Platforms defend moderation discretion while seeking workable liability and transparency rules.",
    },
  },
  {
    id: "crime-policing",
    label: "Crime, policing & sentencing",
    shortLabel: "Crime, policing\n& sentencing",
    kind: "issue",
    x: 820,
    y: 886,
    size: 58,
    eyebrow: "National wedge issue",
    summary: "Safety, police authority, accountability, prosecution, pretrial detention, sentencing, incarceration, prevention, and reintegration form one system.",
    rootScore: 78,
    viewpoints: {
      public: "People want both safety and fair treatment, but perceptions of crime and institutional trust diverge.",
      democratic: "Views range from reform and prevention investment to tougher responses to violent crime.",
      republican: "Generally emphasizes enforcement, prosecution, sentencing, police support, and victim rights.",
      industry: "Police unions, private contractors, courts, service providers, and insurers influence different parts of the system.",
    },
  },
  {
    id: "education-culture",
    label: "Schools, curriculum & parent rights",
    shortLabel: "Schools, curriculum\n& parent rights",
    kind: "issue",
    x: 592,
    y: 884,
    size: 58,
    eyebrow: "National wedge issue",
    summary: "School funding, curriculum, books, parental authority, student privacy, religion, race, gender, testing, and local governance intersect here.",
    rootScore: 73,
    viewpoints: {
      public: "Parents share concern for student success but differ over who should set values and curriculum.",
      democratic: "Often emphasizes inclusive curriculum, professional educators, student services, and public funding.",
      republican: "Often emphasizes parental control, transparency, school choice, and limits on contested content.",
      industry: "Publishers, testing firms, unions, technology providers, and school contractors hold distinct interests.",
    },
  },
  {
    id: "drug-addiction",
    label: "Drug addiction & overdose",
    shortLabel: "Drug addiction\n& overdose",
    kind: "issue",
    x: 350,
    y: 856,
    size: 55,
    eyebrow: "High-impact public issue",
    summary: "Addiction connects prescribing, illicit supply, mental health, housing, trauma, treatment capacity, criminal enforcement, employment, and community stability.",
    rootScore: 80,
    viewpoints: {
      public: "Broad support exists for treatment and stopping trafficking, with disagreement over harm reduction and criminal penalties.",
      democratic: "Often emphasizes treatment access, harm reduction, mental health, and corporate accountability.",
      republican: "Often emphasizes border interdiction, trafficking penalties, public order, and treatment accountability.",
      industry: "Healthcare, pharmaceutical, treatment, insurance, and corrections systems all shape incentives and access.",
    },
  },
  {
    id: "gender-lgbtq-rights",
    label: "LGBTQ+ & gender policy",
    shortLabel: "LGBTQ+ &\ngender policy",
    kind: "issue",
    x: 108,
    y: 842,
    size: 54,
    eyebrow: "National wedge issue",
    summary: "Civil rights, religious liberty, healthcare, school policy, sports, identification documents, family authority, and personal dignity intersect here.",
    rootScore: 72,
    viewpoints: {
      public: "Views vary substantially by policy area, age, religious belief, and whether questions concern adults or minors.",
      democratic: "Generally emphasizes nondiscrimination, personal autonomy, and access to affirming care.",
      republican: "Generally emphasizes sex-based rules, parental authority, religious liberty, and limits for minors.",
      industry: "Healthcare, education, sports, and employers face competing legal, workforce, and customer pressures.",
    },
  },
];

const EDGES: GraphEdge[] = [
  { from: "money-politics", to: "campaign-finance", label: "flows through" },
  { from: "money-politics", to: "lobbying-access", label: "purchases access" },
  { from: "concentrated-wealth", to: "money-politics", label: "amplifies" },
  { from: "money-politics", to: "revolving-door", label: "reinforces" },
  { from: "money-politics", to: "electoral-incentives", label: "shapes" },
  { from: "money-politics", to: "public-voice", label: "can crowd out" },
  { from: "campaign-finance", to: "concentrated-wealth", label: "creates a feedback loop" },
  { from: "lobbying-access", to: "food-land", label: "shapes subsidies" },
  { from: "food-land", to: "regenerative-ag", label: "contains an alternative" },
  { from: "regenerative-ag", to: "soil-water", label: "may improve" },
  { from: "food-land", to: "chronic-disease", label: "affects diets" },
  { from: "regenerative-ag", to: "pollution-health", label: "may reduce runoff" },
  { from: "lobbying-access", to: "healthcare", label: "shapes policy" },
  { from: "healthcare", to: "drug-pricing", label: "includes" },
  { from: "drug-pricing", to: "revolving-door", label: "affected by oversight" },
  { from: "healthcare", to: "chronic-disease", label: "pays for outcomes" },
  { from: "concentrated-wealth", to: "wealth-tax", label: "reinforces" },
  { from: "wealth-tax", to: "tax-code", label: "is structured by" },
  { from: "tax-code", to: "money-politics", label: "creates feedback" },
  { from: "electoral-incentives", to: "housing", label: "rewards local vetoes" },
  { from: "housing", to: "zoning-supply", label: "constrained by" },
  { from: "concentrated-wealth", to: "housing", label: "affects ownership" },
  { from: "public-voice", to: "climate-energy", label: "slows action" },
  { from: "climate-energy", to: "energy-incentives", label: "redirected by" },
  { from: "energy-incentives", to: "lobbying-access", label: "contested through" },
  { from: "climate-energy", to: "pollution-health", label: "drives" },
  { from: "energy-incentives", to: "regenerative-ag", label: "shares climate funding" },
  { from: "pollution-health", to: "chronic-disease", label: "contributes to" },
  { from: "wealth-tax", to: "housing", label: "affects affordability" },
  { from: "abortion-rights", to: "electoral-incentives", label: "drives turnout" },
  { from: "abortion-rights", to: "lobbying-access", label: "organized through" },
  { from: "immigration-border", to: "electoral-incentives", label: "polarizes elections" },
  { from: "immigration-border", to: "housing", label: "intersects with supply" },
  { from: "foreign-policy-war", to: "campaign-finance", label: "shaped by coalitions" },
  { from: "foreign-policy-war", to: "energy-incentives", label: "changes energy security" },
  { from: "gun-policy", to: "lobbying-access", label: "organized through" },
  { from: "gun-policy", to: "crime-policing", label: "intersects with violence" },
  { from: "cost-living", to: "wealth-tax", label: "shaped by distribution" },
  { from: "cost-living", to: "housing", label: "driven by shelter costs" },
  { from: "cost-living", to: "healthcare", label: "driven by care costs" },
  { from: "cost-living", to: "food-land", label: "driven by food prices" },
  { from: "speech-platforms", to: "electoral-incentives", label: "shapes political rewards" },
  { from: "speech-platforms", to: "public-voice", label: "amplifies or buries" },
  { from: "crime-policing", to: "electoral-incentives", label: "mobilizes voters" },
  { from: "crime-policing", to: "drug-addiction", label: "shares enforcement system" },
  { from: "education-culture", to: "public-voice", label: "contested locally" },
  { from: "education-culture", to: "electoral-incentives", label: "drives school elections" },
  { from: "drug-addiction", to: "chronic-disease", label: "increases health burden" },
  { from: "drug-addiction", to: "drug-pricing", label: "linked to prescribing" },
  { from: "gender-lgbtq-rights", to: "education-culture", label: "contested in schools" },
  { from: "gender-lgbtq-rights", to: "electoral-incentives", label: "mobilizes factions" },
];

const KIND_META: Record<NodeKind, { label: string; color: string }> = {
  root: { label: "Root", color: "#ff6b6b" },
  system: { label: "System", color: "#a78bfa" },
  issue: { label: "Issue", color: "#22d3ee" },
  outcome: { label: "Outcome", color: "#34d399" },
  lever: { label: "Leverage point", color: "#fbbf24" },
};

const ISSUE_DESTINATIONS: Record<string, { issueId: string; issueText: string }> = {
  "money-politics": { issueId: "issue_real_campaign-finance-transparency", issueText: "Campaign Finance Transparency" },
  "campaign-finance": { issueId: "issue_real_campaign-finance-transparency", issueText: "Campaign Finance Transparency" },
  "lobbying-access": { issueId: "issue_real_government-accountability", issueText: "Government Accountability" },
  "concentrated-wealth": { issueId: "issue_real_taxes-and-spending", issueText: "Taxes and Spending" },
  "revolving-door": { issueId: "issue_real_government-accountability", issueText: "Government Accountability" },
  "electoral-incentives": { issueId: "issue_real_elections", issueText: "Elections" },
  "public-voice": { issueId: "issue_real_government-accountability", issueText: "Government Accountability" },
  "food-land": { issueId: "issue_real_environment", issueText: "Environment" },
  "regenerative-ag": { issueId: "issue_real_environment", issueText: "Environment" },
  "soil-water": { issueId: "issue_real_water-access", issueText: "Water Access" },
  healthcare: { issueId: "issue_real_healthcare-access", issueText: "Healthcare Access" },
  "drug-pricing": { issueId: "issue_real_healthcare-access", issueText: "Healthcare Access" },
  "chronic-disease": { issueId: "issue_real_healthcare-access", issueText: "Healthcare Access" },
  housing: { issueId: "issue_real_affordable-housing", issueText: "Affordable Housing" },
  "zoning-supply": { issueId: "issue_real_land-use-and-zoning", issueText: "Land Use and Zoning" },
  "wealth-tax": { issueId: "issue_real_taxes-and-spending", issueText: "Taxes and Spending" },
  "tax-code": { issueId: "issue_real_taxes-and-spending", issueText: "Taxes and Spending" },
  "climate-energy": { issueId: "issue_real_environment", issueText: "Environment" },
  "energy-incentives": { issueId: "issue_real_environment", issueText: "Environment" },
  "pollution-health": { issueId: "issue_real_environment", issueText: "Environment" },
  "abortion-rights": { issueId: "issue_topic_reproductive-rights-abortion-and-birth-control-access", issueText: "Reproductive rights, abortion, and birth control access" },
  "immigration-border": { issueId: "issue_topic_birthright-citizenship-and-immigration-eligibility", issueText: "Birthright citizenship and immigration eligibility" },
  "foreign-policy-war": { issueId: "issue_topic_foreign-entanglements-military-aid-and-war-powers", issueText: "Foreign entanglements, military aid, and war powers" },
  "gun-policy": { issueId: "issue_topic_gun-rights-and-firearm-regulation", issueText: "Gun rights and firearm regulation" },
  "cost-living": { issueId: "issue_topic_taxes-spending-debt-and-household-take-home-pay", issueText: "Taxes, spending, debt, and household take-home pay" },
  "speech-platforms": { issueId: "issue_topic_free-speech-online-moderation-and-platform-power", issueText: "Free speech, online moderation, and platform power" },
  "crime-policing": { issueId: "issue_topic_policing-prosecution-sentencing-and-public-safety-reform", issueText: "Policing, prosecution, sentencing, and public safety reform" },
  "education-culture": { issueId: "issue_topic_school-curriculum-parent-rights-and-student-services", issueText: "School curriculum, parent rights, and student services" },
  "drug-addiction": { issueId: "issue_topic_drug-addiction-treatment-and-overdose-prevention", issueText: "Drug addiction, treatment, and overdose prevention" },
  "gender-lgbtq-rights": { issueId: "issue_topic_lgbtq-rights-gender-policy-and-religious-liberty", issueText: "LGBTQ+ rights, gender policy, and religious liberty" },
};

function shortestPathToRoot(startId: string, edges: GraphEdge[]) {
  if (startId === "money-politics") return [startId];

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge.from]);
  }

  const queue: string[][] = [[startId]];
  const visited = new Set([startId]);
  while (queue.length) {
    const path = queue.shift();
    if (!path) break;
    const current = path[path.length - 1];
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      const nextPath = [...path, neighbor];
      if (neighbor === "money-politics") return nextPath;
      visited.add(neighbor);
      queue.push(nextPath);
    }
  }
  return [startId];
}

function communityNodeForSuggestion(suggestion: RootMapSuggestion, index: number): GraphNode {
  return {
    id: `community-${suggestion.id}`,
    label: suggestion.title,
    kind: "issue",
    x: 1460 + Math.floor(index / 6) * 130,
    y: 110 + (index % 6) * 138,
    size: 48,
    eyebrow: "Community-proposed issue · approved",
    summary: suggestion.explanation,
    rootScore: 55,
    communityAdded: true,
    viewpoints: {
      public: "Community proposal approved for exploration; broader public-opinion framing is still being sourced.",
      democratic: "Position summary pending source review.",
      republican: "Position summary pending source review.",
      industry: "Stakeholder position summary pending source review.",
    },
  };
}

function issueActionsFor(node: GraphNode) {
  const destination = ISSUE_DESTINATIONS[node.id];
  const issueText = destination?.issueText ?? node.label;
  const issueRoomHref = destination
    ? `/issues/${destination.issueId}`
    : `/explore?category=issues&q=${encodeURIComponent(issueText)}`;
  const shareParams = new URLSearchParams({
    shareEntityType: "issue",
    shareEntityId: destination?.issueId ?? node.id,
    shareTitle: issueText,
    shareHref: issueRoomHref,
    shareIssueTag: issueText,
  });
  const debateParams = new URLSearchParams({
    issueText,
    title: `What should change about ${node.label}?`,
    description: `Explore the strongest competing approaches to ${node.label}, the tradeoffs involved, and which root causes deserve priority.`,
  });
  return {
    issueText,
    issueRoomHref,
    debatesHref: `${issueRoomHref}?filter=debates`,
    petitionsHref: `${issueRoomHref}?filter=petitions`,
    startDebateHref: `/debates/new?${debateParams.toString()}`,
    startPetitionHref: `/petitions/create?issueText=${encodeURIComponent(issueText)}`,
    contributeHref: `/posts/create?${shareParams.toString()}`,
    voteHref: "/voting?filter=issues",
  };
}

function wrapLabel(node: GraphNode) {
  if (node.shortLabel) return node.shortLabel.split("\n");
  const words = node.label.split(" ");
  if (words.length < 3) return [node.label];
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

type RootStrikerMapProps = {
  approvedSuggestions: RootMapSuggestion[];
  canSuggest: boolean;
  suggestionState?: "submitted" | "error";
};

export function RootStrikerMap({ approvedSuggestions, canSuggest, suggestionState }: RootStrikerMapProps) {
  const [selectedId, setSelectedId] = useState("money-politics");
  const [activeKinds, setActiveKinds] = useState<Set<NodeKind>>(new Set(Object.keys(KIND_META) as NodeKind[]));
  const [traceRoot, setTraceRoot] = useState(true);
  const [query, setQuery] = useState("");
  const [viewBox, setViewBox] = useState<ViewBox>(INITIAL_VIEW_BOX);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [suggestionOpen, setSuggestionOpen] = useState(suggestionState === "error");
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; viewBox: ViewBox } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const graphNodes = useMemo(() => {
    const communityNodes = approvedSuggestions
      .filter((suggestion) => suggestion.type === "new_issue" && suggestion.fromNodeId)
      .map(communityNodeForSuggestion);
    return [...NODES, ...communityNodes];
  }, [approvedSuggestions]);
  const nodeById = useMemo(() => new Map(graphNodes.map((node) => [node.id, node])), [graphNodes]);
  const graphEdges = useMemo(() => {
    const ids = new Set(graphNodes.map((node) => node.id));
    const additions = approvedSuggestions.flatMap((suggestion) => {
      if (suggestion.type === "new_connection" && suggestion.fromNodeId && suggestion.toNodeId && ids.has(suggestion.fromNodeId) && ids.has(suggestion.toNodeId)) {
        return [{ from: suggestion.fromNodeId, to: suggestion.toNodeId, label: suggestion.proposedRelationship ?? "community-proposed link" }];
      }
      const communityNodeId = `community-${suggestion.id}`;
      if (suggestion.type === "new_issue" && suggestion.fromNodeId && ids.has(suggestion.fromNodeId) && ids.has(communityNodeId)) {
        return [{ from: suggestion.fromNodeId, to: communityNodeId, label: suggestion.proposedRelationship ?? "community-proposed link" }];
      }
      return [];
    });
    return [...EDGES, ...additions];
  }, [approvedSuggestions, graphNodes]);
  const selected = nodeById.get(selectedId) ?? graphNodes[0];
  const path = useMemo(() => shortestPathToRoot(selectedId, graphEdges), [graphEdges, selectedId]);
  const pathNodes = useMemo(() => new Set(path), [path]);
  const pathEdges = useMemo(
    () =>
      new Set(
        path.slice(0, -1).map((nodeId, index) => {
          const pair = [nodeId, path[index + 1]].sort();
          return pair.join("::");
        }),
      ),
    [path],
  );
  const neighborIds = useMemo(() => {
    const ids = new Set([selectedId]);
    graphEdges.forEach((edge) => {
      if (edge.from === selectedId) ids.add(edge.to);
      if (edge.to === selectedId) ids.add(edge.from);
    });
    return ids;
  }, [graphEdges, selectedId]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return new Set<string>();
    return new Set(graphNodes.filter((node) => node.label.toLowerCase().includes(normalized)).map((node) => node.id));
  }, [graphNodes, query]);

  function toggleKind(kind: NodeKind) {
    setActiveKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function selectNode(id: string) {
    setSelectedId(id);
    setDetailsOpen(true);
  }

  function zoom(factor: number) {
    setViewBox((current) => {
      const width = Math.min(1900, Math.max(560, current.width * factor));
      const height = width * (950 / 1500);
      return {
        x: current.x + (current.width - width) / 2,
        y: current.y + (current.height - height) / 2,
        width,
        height,
      };
    });
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.1 : 0.9);
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const startedOnNode = event.nativeEvent
      .composedPath()
      .some((target) => target instanceof Element && target.hasAttribute("data-graph-node"));
    if (startedOnNode) return;
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      viewBox,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((event.clientX - drag.clientX) / rect.width) * drag.viewBox.width;
    const dy = ((event.clientY - drag.clientY) / rect.height) * drag.viewBox.height;
    setViewBox({ ...drag.viewBox, x: drag.viewBox.x - dx, y: drag.viewBox.y - dy });
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const connectionCount = graphEdges.filter((edge) => edge.from === selectedId || edge.to === selectedId).length;
  const pathLabel = [...path].reverse().map((id) => nodeById.get(id)?.label ?? id);
  const civicActions = issueActionsFor(selected);

  return (
    <div className={styles.experimentShell}>
      <div className={styles.ambientGlow} aria-hidden="true" />
      <header className={styles.topbar}>
        <div className={styles.brandBlock}>
          <Link href="/" className={styles.backButton} aria-label="Back to Direct Democracy">
            <ArrowLeft size={16} />
          </Link>
          <div className={styles.mark} aria-hidden="true">
            <Crosshair size={22} />
          </div>
          <div>
            <div className={styles.titleRow}>
              <h1>ROOT STRIKER</h1>
              <span>LAB 01</span>
            </div>
            <p>Trace the problems you see to the systems beneath them.</p>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.liveDot} />
          <span>Interactive hypothesis map</span>
          <span className={styles.divider} />
          <span>{graphNodes.length} nodes · {graphEdges.length} links</span>
        </div>
      </header>

      <section className={styles.controlBar} aria-label="Map controls">
        <label className={styles.searchBox}>
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an issue or root…"
            aria-label="Find an issue or root"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={15} />
            </button>
          ) : null}
        </label>

        <div className={styles.filters}>
          <span className={styles.filterLabel}>
            <Filter size={14} /> Layers
          </span>
          {(Object.keys(KIND_META) as NodeKind[]).map((kind) => (
            <button
              type="button"
              key={kind}
              onClick={() => toggleKind(kind)}
              className={activeKinds.has(kind) ? styles.filterActive : ""}
              style={{ "--kind-color": KIND_META[kind].color } as React.CSSProperties}
              aria-pressed={activeKinds.has(kind)}
            >
              <span />
              {KIND_META[kind].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`${styles.traceButton} ${traceRoot ? styles.traceActive : ""}`}
          onClick={() => setTraceRoot((current) => !current)}
          aria-pressed={traceRoot}
        >
          <Sparkles size={15} />
          Trace to root
        </button>
        {canSuggest ? (
          <button type="button" className={styles.suggestButton} onClick={() => setSuggestionOpen(true)}>
            <Lightbulb size={15} /> Suggest a link
          </button>
        ) : (
          <Link href="/auth?next=%2Froot-striker-lab" className={styles.suggestButton}>
            <Lightbulb size={15} /> Sign in to suggest
          </Link>
        )}
      </section>

      {suggestionState === "submitted" ? (
        <div className={styles.submissionNotice} role="status">
          <ShieldCheck size={16} /> Suggestion received. It will stay private until an administrator reviews it.
        </div>
      ) : null}

      <main className={`${styles.workspace} ${detailsOpen ? styles.hasDetails : ""}`}>
        <section className={styles.mapPanel} aria-label="Interactive civic root-cause map">
          <div className={styles.mapInstructions}>
            <span>DRAG TO EXPLORE</span>
            <span>·</span>
            <span>SCROLL TO ZOOM</span>
            <span>·</span>
            <span>SELECT A NODE</span>
          </div>

          <svg
            ref={svgRef}
            className={styles.graph}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="application"
            aria-label="Issue relationship web. Select nodes to inspect them."
          >
            <defs>
              <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="root-fill" cx="35%" cy="30%">
                <stop offset="0%" stopColor="#ff9f86" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#3d101f" stopOpacity="0.9" />
              </radialGradient>
            </defs>

            <g className={styles.edgeLayer}>
              {graphEdges.map((edge) => {
                const from = nodeById.get(edge.from);
                const to = nodeById.get(edge.to);
                if (!from || !to) return null;
                const visible = activeKinds.has(from.kind) && activeKinds.has(to.kind);
                const key = [edge.from, edge.to].sort().join("::");
                const active = traceRoot ? pathEdges.has(key) : edge.from === selectedId || edge.to === selectedId;
                const faded = !active && (traceRoot ? !pathNodes.has(edge.from) && !pathNodes.has(edge.to) : !neighborIds.has(edge.from) && !neighborIds.has(edge.to));
                const midpointX = (from.x + to.x) / 2;
                const midpointY = (from.y + to.y) / 2;
                return (
                  <g key={`${edge.from}-${edge.to}`} className={!visible ? styles.hidden : undefined}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      className={`${styles.edge} ${active ? styles.edgeActive : ""} ${faded ? styles.edgeFaded : ""}`}
                    />
                    {active ? (
                      <g className={styles.edgeLabel} transform={`translate(${midpointX} ${midpointY})`}>
                        <rect x={-edge.label.length * 3.5 - 8} y={-12} width={edge.label.length * 7 + 16} height={24} rx={12} />
                        <text textAnchor="middle" dominantBaseline="central">{edge.label}</text>
                      </g>
                    ) : null}
                  </g>
                );
              })}
            </g>

            <g className={styles.nodeLayer}>
              {graphNodes.map((node) => {
                const isSelected = node.id === selectedId;
                const isPath = traceRoot ? pathNodes.has(node.id) : neighborIds.has(node.id);
                const isMatch = matches.has(node.id);
                const visible = activeKinds.has(node.kind) || isSelected;
                const color = KIND_META[node.kind].color;
                const labelLines = wrapLabel(node);
                return (
                  <g
                    key={node.id}
                    data-graph-node
                    role="button"
                    tabIndex={visible ? 0 : -1}
                    aria-label={`${node.label}, ${KIND_META[node.kind].label}`}
                    aria-pressed={isSelected}
                    transform={`translate(${node.x} ${node.y})`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      selectNode(node.id);
                    }}
                    onClick={() => selectNode(node.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectNode(node.id);
                      }
                    }}
                    className={`${styles.node} ${isSelected ? styles.nodeSelected : ""} ${isPath ? styles.nodeInPath : ""} ${isMatch ? styles.nodeMatch : ""} ${!visible ? styles.hidden : ""}`}
                    style={{ "--node-color": color } as React.CSSProperties}
                  >
                    <circle className={styles.nodeHalo} r={node.size + (node.kind === "root" ? 20 : 12)} />
                    <circle className={styles.nodeOrbit} r={node.size + 7} />
                    <circle className={styles.nodeBody} r={node.size} fill={node.kind === "root" ? "url(#root-fill)" : undefined} />
                    {node.kind === "root" ? (
                      <g transform="translate(0 -22)" className={styles.rootIcon}>
                        <circle r="15" />
                        <text textAnchor="middle" dominantBaseline="central">$</text>
                      </g>
                    ) : null}
                    <text className={styles.nodeText} textAnchor="middle" transform={node.kind === "root" ? "translate(0 13)" : undefined}>
                      {labelLines.map((line, index) => (
                        <tspan key={line} x="0" dy={index === 0 ? (labelLines.length === 1 ? 4 : -3) : 15}>{line}</tspan>
                      ))}
                    </text>
                    <circle className={styles.nodePing} cx={node.size * 0.7} cy={-node.size * 0.7} r="4" />
                  </g>
                );
              })}
            </g>
          </svg>

          <div className={styles.zoomControls}>
            <button type="button" onClick={() => zoom(0.86)} aria-label="Zoom in"><Plus size={17} /></button>
            <button type="button" onClick={() => zoom(1.16)} aria-label="Zoom out"><Minus size={17} /></button>
            <button type="button" onClick={() => setViewBox(INITIAL_VIEW_BOX)} aria-label="Reset map view"><RotateCcw size={16} /></button>
          </div>

          {!detailsOpen ? (
            <button type="button" className={styles.openDetails} onClick={() => setDetailsOpen(true)}>
              <Info size={16} /> Inspect node
            </button>
          ) : null}
        </section>

        {detailsOpen ? (
          <aside className={styles.detailPanel} aria-live="polite">
            <button type="button" className={styles.closeDetails} onClick={() => setDetailsOpen(false)} aria-label="Close details">
              <X size={17} />
            </button>
            <div className={styles.kindLabel} style={{ "--kind-color": KIND_META[selected.kind].color } as React.CSSProperties}>
              <span /> {selected.eyebrow}
            </div>
            <h2>{selected.label}</h2>
            <p className={styles.summary}>{selected.summary}</p>

            <div className={styles.scoreCard}>
              <div>
                <span>ROOT SCORE</span>
                <strong>{selected.rootScore}</strong>
                <small>/100</small>
              </div>
              <div className={styles.scoreTrack}>
                <span style={{ width: `${selected.rootScore}%` }} />
              </div>
              <p>Illustrative measure of reach, leverage, impact, and connection density.</p>
            </div>

            <div className={styles.connectionStat}>
              <div>
                <Focus size={17} />
                <span><strong>{connectionCount}</strong> direct connections</span>
              </div>
              <button type="button" onClick={() => setTraceRoot(true)}>Trace root <ChevronRight size={14} /></button>
            </div>

            <div className={styles.pathBlock}>
              <h3>Path to the root</h3>
              <div className={styles.pathTrail}>
                {pathLabel.map((label, index) => (
                  <div key={label}>
                    <span>{index + 1}</span>
                    <p>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.civicActions}>
              <div className={styles.sectionHeading}>
                <h3>Go from insight to action</h3>
                <span>PARTICIPATE</span>
              </div>
              <Link href={civicActions.issueRoomHref} className={styles.primaryCivicAction}>
                <Focus size={15} /> Open the issue room <ChevronRight size={14} />
              </Link>
              <div className={styles.actionGrid}>
                <Link href={civicActions.contributeHref}><PenLine size={14} /><span>Contribute</span></Link>
                <Link href={civicActions.debatesHref}><MessageSquare size={14} /><span>Debates</span></Link>
                <Link href={civicActions.startDebateHref}><Plus size={14} /><span>Start debate</span></Link>
                <Link href={civicActions.petitionsHref}><FileText size={14} /><span>Petitions</span></Link>
                <Link href={civicActions.startPetitionHref}><Plus size={14} /><span>Create petition</span></Link>
                <Link href={civicActions.voteHref}><Vote size={14} /><span>Vote</span></Link>
              </div>
            </div>

            <div className={styles.viewpoints}>
              <div className={styles.sectionHeading}>
                <h3>Perspective lens</h3>
                <span>ILLUSTRATIVE</span>
              </div>
              <div><span className={styles.publicDot}>P</span><p><strong>Public</strong>{selected.viewpoints.public}</p></div>
              <div><span className={styles.demDot}>D</span><p><strong>Democratic</strong>{selected.viewpoints.democratic}</p></div>
              <div><span className={styles.gopDot}>R</span><p><strong>Republican</strong>{selected.viewpoints.republican}</p></div>
              <div><span className={styles.industryDot}>$</span><p><strong>Industry</strong>{selected.viewpoints.industry}</p></div>
            </div>

            <div className={styles.evidenceNotice}>
              <Info size={16} />
              <p><strong>Evidence-first map</strong>Core links are editorial hypotheses; community additions appear only after admin review. Open the issue room for source-backed civic records.</p>
            </div>
          </aside>
        ) : null}
      </main>

      <footer className={styles.footerBar}>
        <div><CircleDollarSign size={15} /> Start at a symptom. Follow the incentives. Strike the root.</div>
        <span>COMMUNITY CONNECTIONS REQUIRE ADMIN APPROVAL</span>
      </footer>

      {suggestionOpen ? (
        <div className={styles.suggestionOverlay} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSuggestionOpen(false);
        }}>
          <section className={styles.suggestionDialog} role="dialog" aria-modal="true" aria-labelledby="root-suggestion-title">
            <button type="button" className={styles.closeSuggestion} onClick={() => setSuggestionOpen(false)} aria-label="Close suggestion form"><X size={18} /></button>
            <div className={styles.kindLabel} style={{ "--kind-color": "#fbbf24" } as React.CSSProperties}><span /> Community proposal</div>
            <h2 id="root-suggestion-title">Help improve the root map</h2>
            <p>Suggest an issue, a connection between two nodes, or a correction. Your proposal remains private until an administrator reviews the reasoning and sources.</p>
            {suggestionState === "error" ? <div className={styles.formError}>Check the required fields and give at least a short explanation of the relationship.</div> : null}
            <form action={submitRootMapSuggestion} className={styles.suggestionForm}>
              <label>
                <span>What are you proposing?</span>
                <select name="type" defaultValue="new_connection">
                  <option value="new_connection">A new connection</option>
                  <option value="new_issue">A missing issue</option>
                  <option value="correction">A correction or stronger source</option>
                </select>
              </label>
              <label>
                <span>Short title</span>
                <input name="title" required minLength={4} maxLength={120} placeholder="Example: Childcare costs affect workforce participation" />
              </label>
              <div className={styles.suggestionNodeGrid}>
                <label>
                  <span>Start / related node</span>
                  <select name="fromNodeId" defaultValue={selected.id}>
                    {graphNodes.map((node) => <option key={`from-${node.id}`} value={node.id}>{node.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Connect to (if applicable)</span>
                  <select name="toNodeId" defaultValue="">
                    <option value="">Choose a second node</option>
                    {graphNodes.map((node) => <option key={`to-${node.id}`} value={node.id}>{node.label}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span>Relationship label</span>
                <input name="proposedRelationship" maxLength={80} placeholder="Example: increases, funds, constrains, reduces" />
              </label>
              <label>
                <span>Why does this belong on the map?</span>
                <textarea name="explanation" required minLength={20} maxLength={1800} rows={5} placeholder="Explain the causal path, tradeoff, affected people, and what would make this a high-leverage root or connection." />
              </label>
              <label>
                <span>Supporting sources</span>
                <textarea name="sourceUrls" rows={3} placeholder="One public URL per line. Research, government data, legislation, or credible reporting." />
              </label>
              <div className={styles.reviewPromise}><ShieldCheck size={16} /><span>No suggestion publishes automatically. Administrators can approve or reject it and record review notes.</span></div>
              <button type="submit" className={styles.submitSuggestion}>Send for review</button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
