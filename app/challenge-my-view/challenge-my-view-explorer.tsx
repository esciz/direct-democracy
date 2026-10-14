"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenCheck, GitBranch, Handshake, Heart, RotateCcw, Scale, Sparkles, Users } from "lucide-react";
import { useState } from "react";

import type { ChallengeTopic } from "@/lib/perspectives/types";
import styles from "./challenge-my-view.module.css";

type Stance = "agree" | "unsure" | "disagree";
type LensKey = "shared" | "evidence" | "people" | "options";

const TOPICS: ChallengeTopic[] = [
  {
    id: "sex-gender-policy",
    category: "Sex and gender",
    statement: "Public policy should generally use two sex categories.",
    context: "The meaning of sex and gender can change with the setting: medicine, identity documents, civil rights, athletics, schools, or statistical records.",
    caseFor: {
      label: "Strongest case for",
      headline: "Stable sex categories can protect clarity and sex-based rights",
      summary: "Supporters argue that many laws and statistics need consistent biological categories, especially when tracking health differences, discrimination, privacy, or opportunities created for women and girls.",
      question: "Where would replacing a sex category with self-identified gender make a policy less accurate or less protective?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "A universal binary can erase relevant biological and social realities",
      summary: "Critics argue that sex traits are not identical in every person and that gender identity can be legally or socially relevant. A single rule across every setting may produce inaccurate records or unnecessary harm.",
      question: "Which policies truly require a binary category, and which could record sex traits and gender identity separately?",
    },
    shared: ["Accurate public records", "Protection from discrimination", "Clear rules people can understand"],
    evidence: ["How medical and demographic systems define their variables", "Frequency and policy relevance of variations in sex traits", "Effects of alternative identity-document rules"],
    people: ["Women relying on sex-discrimination protections", "Transgender and intersex people", "Clinicians, researchers, schools, and record keepers"],
    options: ["Keep sex categories where materially relevant", "Record sex and gender identity separately", "Use context-specific definitions with public explanations"],
  },
  {
    id: "womens-sports",
    category: "Women’s sports",
    statement: "Eligibility for women’s sports should primarily follow sex-based categories.",
    context: "The tradeoffs differ by age, sport, level of competition, contact, puberty, and whether the goal is broad participation or elite performance.",
    caseFor: {
      label: "Strongest case for",
      headline: "Sex-based categories preserve fair and meaningful competition",
      summary: "Supporters argue that physical differences associated with male puberty can matter in many sports and that women’s categories exist to preserve safety, opportunity, records, scholarships, and competitive fairness.",
      question: "What rules preserve a protected competitive category when performance differences are material?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Blanket exclusions can sacrifice inclusion without measuring actual advantage",
      summary: "Critics argue that transgender athletes should not be treated as a single competitive risk and that rules can account for age, treatment, sport, and level rather than excluding people categorically.",
      question: "Could sport-specific standards protect competition while avoiding unnecessary exclusion?",
    },
    shared: ["Fair competition", "Safe participation", "Dignity and opportunity for every athlete"],
    evidence: ["Sport-specific effects of puberty and hormone treatment", "Differences between youth, recreational, scholastic, and elite play", "Participation and competitive-outcome data"],
    people: ["Women and girls competing for roster spots and awards", "Transgender athletes and their families", "Coaches, teammates, schools, and governing bodies"],
    options: ["Sex-based eligibility rules", "Sport- and level-specific standards", "Open or additional categories where participation permits"],
  },
  {
    id: "abortion-viability",
    category: "Abortion",
    statement: "Abortion should generally remain legal before fetal viability.",
    context: "People disagree about moral status, bodily autonomy, medical exceptions, the role of government, and when legal protection should begin.",
    caseFor: {
      label: "Strongest case for",
      headline: "Pregnancy decisions should remain with the patient before viability",
      summary: "Supporters argue that government should not compel someone to continue a pregnancy and that physicians need room to respond to health, fetal, economic, and family circumstances without criminal uncertainty.",
      question: "When should the state be allowed to override a pregnant person’s medical and personal decision?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Human life deserves legal protection before viability",
      summary: "Critics argue that dependence does not remove the fetus’s moral value and that viability changes with technology and geography, making it an unstable boundary for deciding when legal protection begins.",
      question: "If fetal life has moral value, what protections should exist before viability and how should exceptions work?",
    },
    shared: ["Fewer preventable medical tragedies", "Support for parents and children", "Rules that are understandable in urgent care"],
    evidence: ["Medical meaning and limits of viability", "Effects of restrictions on health outcomes and access", "Effects of financial and family supports on pregnancy decisions"],
    people: ["Pregnant patients and families", "Fetuses and future children", "Clinicians, faith communities, and adoption or support networks"],
    options: ["Pre-viability access with later limits", "Earlier limits with defined exceptions", "Expanded contraception, prenatal care, and family support regardless of legal rule"],
  },
  {
    id: "immigration-enforcement",
    category: "Immigration",
    statement: "The federal government should prioritize reducing unauthorized immigration even if asylum processing becomes more restrictive.",
    context: "Border policy combines sovereignty, humanitarian obligations, labor demand, administrative capacity, security, and the realities facing mixed-status families.",
    caseFor: {
      label: "Strongest case for",
      headline: "A credible immigration system requires enforceable boundaries",
      summary: "Supporters argue that inconsistent enforcement rewards unlawful entry, overwhelms processing and local services, empowers smugglers, and weakens public support for legal immigration.",
      question: "How can asylum remain meaningful if the system cannot promptly distinguish qualifying claims from other migration?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Restriction can deny protection and ignore why the system is overwhelmed",
      summary: "Critics argue that deterrence-heavy policy can return people to danger, divide families, and treat administrative backlogs as individual wrongdoing while legal pathways remain too narrow for real labor and humanitarian needs.",
      question: "Which enforcement tools reduce disorder without denying due process or protection to people with valid claims?",
    },
    shared: ["Orderly and timely decisions", "Less exploitation by smugglers and abusive employers", "A legal system the public can trust"],
    evidence: ["Who qualifies for asylum after full adjudication", "Effects of enforcement and legal pathways on crossings", "Local fiscal and labor-market impacts"],
    people: ["Border communities and public workers", "Migrants, asylum seekers, and mixed-status families", "Employers, workers, and legal immigrants"],
    options: ["Faster adjudication with more capacity", "Expanded legal pathways paired with enforcement", "Regional processing and humanitarian coordination"],
  },
  {
    id: "gun-safety",
    category: "Gun policy",
    statement: "Gun purchases should face stronger background-check and safe-storage requirements.",
    context: "The dispute involves public safety, self-defense, constitutional rights, enforcement disparities, privacy, and which interventions prevent harm without burdening lawful ownership.",
    caseFor: {
      label: "Strongest case for",
      headline: "Basic safeguards can reduce access during moments of danger",
      summary: "Supporters argue that consistent checks and secure storage can make impulsive suicide, domestic violence, theft, and accidental shootings less likely while preserving ownership for people who may legally possess firearms.",
      question: "Which preventable harms justify a modest delay or storage responsibility for gun owners?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Rules can burden lawful defense while missing people who ignore them",
      summary: "Critics argue that added requirements create cost, delay, privacy, and enforcement risks for lawful owners, while illegal markets and failures to act on existing records may remain the larger problem.",
      question: "How can a safeguard be designed so it targets demonstrated risk rather than creating a broad barrier to self-defense?",
    },
    shared: ["Fewer suicides, accidents, and violent crimes", "Effective due process", "Responsible ownership and legitimate self-defense"],
    evidence: ["Effects of permit, background-check, and storage policies", "Sources of firearms used in different categories of harm", "Error rates, costs, and enforcement disparities"],
    people: ["Survivors and communities experiencing violence", "Lawful owners and people seeking protection", "Families, police, retailers, and mental-health responders"],
    options: ["Universal checks with rapid appeals", "Targeted risk-based interventions", "Storage incentives, education, and owner-supported safety programs"],
  },
  {
    id: "race-conscious-opportunity",
    category: "Race-conscious policy",
    statement: "Public institutions should sometimes consider race when addressing unequal opportunity.",
    context: "The disagreement is about how institutions should respond to persistent racial disparities while also protecting individual treatment, equal rules, and public trust.",
    caseFor: {
      label: "Strongest case for",
      headline: "Race-neutral rules can preserve unequal conditions created by past and present barriers",
      summary: "Supporters argue that institutions cannot remedy exclusion they refuse to measure, and that carefully limited consideration of race may help identify barriers, broaden opportunity, and prevent formally neutral systems from reproducing unequal access.",
      question: "When does ignoring race make it harder to identify or repair a barrier that operates along racial lines?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Government should not sort individuals by race to pursue group outcomes",
      summary: "Critics argue that race-conscious decisions can stereotype people, disadvantage individuals who did not cause past injustice, obscure class and other hardship, and weaken the principle that public institutions should treat citizens without racial preference.",
      question: "How can institutions address unequal opportunity without assigning benefits or burdens through racial categories?",
    },
    shared: ["Wider access to genuine opportunity", "Individual dignity rather than racial stereotyping", "Transparent standards the public can evaluate"],
    evidence: ["Which barriers remain after income and geography are considered", "Outcomes of race-conscious and race-neutral alternatives", "How different policies affect trust, mobility, and institutional access"],
    people: ["Students, workers, and applicants from historically excluded communities", "Applicants who fear unfair individual treatment", "Schools, employers, agencies, and the public they serve"],
    options: ["Race-conscious outreach with race-neutral selection", "Socioeconomic and neighborhood-based preferences", "Time-limited remedies with public outcome reviews"],
  },
  {
    id: "reparations",
    category: "Reparations",
    statement: "Government should provide targeted reparative benefits for the lasting harms of slavery and legally enforced racial discrimination.",
    context: "The debate concerns historical responsibility, present-day effects, eligibility, cost, evidence, and whether repair should be individual, community-based, universal, or symbolic.",
    caseFor: {
      label: "Strongest case for",
      headline: "Documented public harms can create a public obligation to repair their lasting effects",
      summary: "Supporters argue that slavery, segregation, exclusion from public programs, and discriminatory policy transferred wealth and opportunity across generations, making targeted repair a response to specific government action rather than collective guilt.",
      question: "If government-created losses remain measurable, what form of repair would be proportional and administratively fair?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Assigning present benefits and costs by ancestry can create new unfairness",
      summary: "Critics argue that eligibility and causation are difficult to define, current taxpayers are not personally responsible for historic wrongdoing, and broad investments based on present need may help disadvantaged people without dividing citizens by ancestry.",
      question: "Can repair address historically specific harm without imposing an inherited system of entitlement and liability?",
    },
    shared: ["Honest recognition of documented injustice", "More mobility and less inherited disadvantage", "A remedy that can be administered transparently"],
    evidence: ["Traceable effects of specific discriminatory public policies", "Distributional effects of cash, housing, education, or community investment", "Eligibility accuracy, administrative costs, and public legitimacy"],
    people: ["Descendants of people harmed by slavery and discriminatory law", "Other families experiencing intergenerational poverty", "Taxpayers and communities receiving or funding remedies"],
    options: ["Eligibility tied to documented government harm", "Place-based housing and wealth-building investment", "Universal programs paired with targeted enforcement and historical acknowledgment"],
  },
  {
    id: "policing-disparities",
    category: "Race and policing",
    statement: "Racial disparities in policing require structural reform, not only better enforcement of existing rules.",
    context: "People disagree about what disparities demonstrate, how crime exposure and deployment affect data, whether institutions or individuals drive unequal outcomes, and which reforms improve both safety and legitimacy.",
    caseFor: {
      label: "Strongest case for",
      headline: "Repeated disparities can reflect incentives and practices larger than individual misconduct",
      summary: "Supporters argue that deployment patterns, stop standards, use-of-force policy, accountability systems, and neighborhood conditions can produce unequal treatment even without explicit prejudice by every officer.",
      question: "Which institutional rules continue to generate unequal outcomes after individual intent is set aside?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Disparity alone does not identify its cause or prove a system is discriminatory",
      summary: "Critics argue that police contact differs with reported crime, victim requests, location, and exposure, and that broad structural accusations can demoralize effective officers or produce pullbacks that harm the same communities reform is intended to protect.",
      question: "Which comparisons can distinguish biased practice from differences in exposure, deployment, and public requests for service?",
    },
    shared: ["Safe neighborhoods", "Equal treatment and accountable authority", "Reliable data that supports correction rather than slogans"],
    evidence: ["Comparable stop, search, force, clearance, and complaint outcomes", "Effects of deployment and enforcement changes on victimization", "Performance of independent review, training, supervision, and alternative response"],
    people: ["Residents in heavily policed and high-crime neighborhoods", "Crime victims and people wrongly stopped or harmed", "Officers, dispatchers, social workers, and local governments"],
    options: ["Clearer standards and independent accountability", "Focused enforcement paired with community oversight", "Alternative responders for appropriate calls and stronger violence-prevention services"],
  },
  {
    id: "systemic-racism-curriculum",
    category: "Race in schools",
    statement: "Public schools should explicitly teach how systemic racism has shaped American institutions and present-day outcomes.",
    context: "The dispute is about historical accuracy, age-appropriate instruction, contested interpretations, parental trust, national identity, and whether teaching systems assigns guilt to children.",
    caseFor: {
      label: "Strongest case for",
      headline: "Students cannot understand current institutions without studying how past rules shaped them",
      summary: "Supporters argue that slavery, segregation, exclusionary law, and civil-rights struggles are central to American history, and that examining institutional effects develops civic understanding rather than assigning personal blame.",
      question: "How can students evaluate today’s debates if major historical systems and their consequences are softened or omitted?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "A broad systemic framework can become ideological and flatten a complex national history",
      summary: "Critics argue that some curricula present contested claims as settled, reduce people to racial groups, imply inherited guilt, or understate progress and individual agency. They favor teaching documented events while distinguishing fact from interpretation.",
      question: "How should schools teach injustice fully while making clear which claims are historical facts and which are debated frameworks?",
    },
    shared: ["Historically accurate education", "Students treated as individuals rather than racial representatives", "The ability to discuss difficult history without intimidation"],
    evidence: ["Actual curriculum materials rather than political summaries", "Student learning, belonging, and civic-reasoning outcomes", "Clarity between primary evidence, scholarly interpretation, and advocacy"],
    people: ["Students from every racial and family background", "Teachers asked to lead difficult discussions", "Parents, historians, school boards, and local communities"],
    options: ["Primary-source-centered instruction", "Multiple scholarly interpretations with age-appropriate framing", "Public curriculum review and clear rules against compelled personal belief"],
  },
  {
    id: "voter-identification",
    category: "Voting rules",
    statement: "Voters should generally present government-issued identification when voting in person.",
    context: "The argument weighs election confidence and consistent identity checks against access barriers, unequal document possession, administrative burdens, and the actual frequency of identity-related fraud.",
    caseFor: {
      label: "Strongest case for",
      headline: "A clear identity check is a modest safeguard that can strengthen confidence",
      summary: "Supporters argue that identification is routine for consequential transactions, helps maintain accurate voting records, and can reassure voters that each ballot belongs to an eligible person if IDs are readily available.",
      question: "If identification is free and accessible, what reason remains not to use a consistent check?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "A solution to rare impersonation can impose unequal costs on eligible voters",
      summary: "Critics argue that obtaining underlying documents, transportation, time, and matching records can burden older, poor, disabled, rural, and frequently moving voters, while in-person impersonation is not the main election-security vulnerability.",
      question: "What level of prevented risk justifies rejecting or delaying an otherwise eligible voter’s ballot?",
    },
    shared: ["Only eligible voters casting one ballot", "No eligible citizen blocked by avoidable bureaucracy", "Results the public can verify and trust"],
    evidence: ["Rates and types of documented election irregularity", "ID possession and provisional-ballot cure rates", "Effects of free ID, alternatives, and outreach"],
    people: ["Eligible voters without current documents", "Election workers and officials", "Voters concerned about access or integrity"],
    options: ["Free IDs with mobile issuance and broad alternatives", "Signature or database verification", "Provisional ballots with simple, well-funded cure processes"],
  },
  {
    id: "citizenship-pathway",
    category: "Immigration status",
    statement: "Long-term undocumented residents who meet defined requirements should have a pathway to citizenship.",
    context: "The issue combines the rule of law, family and community ties, labor, deterrence, fairness to legal immigrants, administrative feasibility, and what requirements should accompany legal status.",
    caseFor: {
      label: "Strongest case for",
      headline: "Permanent exclusion is costly when people have built durable lives and responsibilities here",
      summary: "Supporters argue that earned legalization can bring workers into full compliance, stabilize families, improve tax and labor enforcement, and recognize years of contribution while reserving removal for serious threats.",
      question: "What realistic outcome is better for the country than indefinitely keeping millions of established residents outside lawful civic life?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Citizenship after unlawful presence can undermine deterrence and fairness to legal applicants",
      summary: "Critics argue that legal status is a valuable benefit, repeated amnesties encourage future unauthorized migration, and reform should first create credible enforcement and respect people who waited or complied with legal pathways.",
      question: "How can an earned pathway avoid communicating that violating immigration law will ultimately be rewarded?",
    },
    shared: ["A workable legal immigration system", "Families and workers protected from exploitation", "Rules that discourage future unlawful entry"],
    evidence: ["Fiscal, wage, enforcement, and family effects of past legalization", "Effects on future migration and legal-processing backlogs", "Administrative capacity to verify residence, taxes, and disqualifying conduct"],
    people: ["Long-term undocumented residents and mixed-status families", "Legal immigrants and people waiting abroad", "Workers, employers, schools, and local communities"],
    options: ["Earned citizenship with fines and background checks", "Renewable legal status without citizenship", "Legalization paired with employment verification and expanded lawful pathways"],
  },
  {
    id: "homeless-encampments",
    category: "Homelessness",
    statement: "Cities should be able to clear public encampments even when permanent housing is not immediately available.",
    context: "The conflict concerns public-space access, health and safety, personal property, disability, shelter capacity, neighborhood impacts, and whether enforcement helps people exit homelessness or merely moves them.",
    caseFor: {
      label: "Strongest case for",
      headline: "Public spaces cannot safely become indefinite unsheltered settlements",
      summary: "Supporters argue that cities have duties to maintain sidewalks, parks, sanitation, fire access, and neighborhood safety, and that allowing dangerous encampments to persist can abandon both housed residents and people living there.",
      question: "What should a city do when an encampment creates immediate hazards but adequate permanent housing does not yet exist?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Displacement without a safe alternative can worsen instability while hiding the problem",
      summary: "Critics argue that sweeps can destroy medication and documents, separate people from outreach, impose fines they cannot pay, and repeatedly relocate residents without addressing housing, treatment, income, or disability needs.",
      question: "If a person has nowhere lawful and safe to go, what public benefit is achieved by repeatedly moving them?",
    },
    shared: ["Safe and usable public spaces", "Fewer people living outdoors", "Responses that reduce rather than recycle crisis"],
    evidence: ["Housing and health outcomes after different encampment interventions", "Availability and suitability of shelter at the time of enforcement", "Neighborhood safety, sanitation, and public-cost effects"],
    people: ["People living in encampments", "Nearby residents, businesses, and public-space users", "Outreach workers, police, sanitation crews, and service providers"],
    options: ["Notice and storage protections paired with safe shelter", "Sanctioned sites with services and deadlines", "Housing-first capacity plus targeted enforcement of specific hazards"],
  },
  {
    id: "religious-exemptions",
    category: "Religion and civil rights",
    statement: "Religious organizations and individuals should receive limited exemptions from some nondiscrimination requirements.",
    context: "The dispute involves free exercise, equal access, compelled participation, public accommodations, government funding, harm to third parties, and where private belief becomes public conduct.",
    caseFor: {
      label: "Strongest case for",
      headline: "Pluralism sometimes requires room not to participate in conduct that violates conscience",
      summary: "Supporters argue that narrow exemptions protect religious diversity and prevent government from forcing people or faith communities to affirm, facilitate, or fund practices contrary to sincere beliefs when alternatives are reasonably available.",
      question: "When can an accommodation preserve equal access without compelling an individual’s speech or religious participation?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Exemptions can transfer the burden of another person’s belief onto people seeking equal treatment",
      summary: "Critics argue that public businesses, licensed professionals, or publicly funded services should not deny otherwise available goods or care based on a customer’s identity, especially where alternatives are scarce or delay creates harm.",
      question: "At what point does protecting conscience authorize discrimination that civil-rights rules were enacted to prevent?",
    },
    shared: ["Freedom of belief and worship", "Equal access to essential goods and services", "Narrow rules that minimize harm to others"],
    evidence: ["Availability and burden of alternative providers", "Difference between expressive and routine services", "Effects of exemptions in healthcare, employment, education, and commerce"],
    people: ["Religious individuals and institutions", "LGBTQ people and others protected by nondiscrimination law", "Employees, customers, patients, and publicly funded service users"],
    options: ["Exemptions limited to expressive services", "Accommodation only when equal access is immediate", "Stricter obligations for public funding, monopolies, and essential care"],
  },
  {
    id: "climate-mandates",
    category: "Climate policy",
    statement: "Government should require a faster transition away from fossil fuels even if near-term energy costs rise.",
    context: "The debate weighs climate damages and technological transition against affordability, reliability, regional employment, permitting, national competitiveness, and who bears near-term costs.",
    caseFor: {
      label: "Strongest case for",
      headline: "Delayed transition shifts larger costs and risks onto the public and future generations",
      summary: "Supporters argue that markets do not fully price pollution and climate damage, that clear standards accelerate investment, and that near-term transition costs can be offset while avoiding more expensive disasters and stranded infrastructure.",
      question: "If voluntary change remains too slow, what policy can reduce emissions at the speed the risk requires?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Mandates can raise essential costs faster than infrastructure and technology can adjust",
      summary: "Critics argue that households and industry need reliable, affordable energy; premature deadlines can strain grids, shift production abroad, punish lower-income families, and provoke backlash that makes durable climate progress harder.",
      question: "How should policy respond when an emissions deadline advances faster than reliable replacement capacity?",
    },
    shared: ["Reliable and affordable energy", "Less pollution and climate risk", "A transition workers and communities can sustain"],
    evidence: ["Full system costs, reliability, and emissions by technology", "Household and regional distribution of transition costs", "Performance of mandates, carbon pricing, subsidies, permitting, and research"],
    people: ["Low-income households and energy-burdened communities", "Workers and regions tied to fossil-energy production", "People exposed to pollution, heat, fire, drought, and flooding"],
    options: ["Technology-neutral clean-energy standards", "Carbon pricing with household dividends", "Faster permitting, firm clean power, and targeted transition support"],
  },
  {
    id: "wealth-taxation",
    category: "Taxing wealth",
    statement: "Extremely wealthy households should pay an annual tax based partly on their net wealth, not only realized income.",
    context: "The disagreement concerns tax fairness, unrealized gains, constitutional and administrative limits, valuation, avoidance, investment incentives, and whether other tax reforms would work better.",
    caseFor: {
      label: "Strongest case for",
      headline: "Income-only taxation can miss enormous increases in economic power",
      summary: "Supporters argue that the wealthiest households can defer taxable gains while borrowing against appreciating assets, so a carefully designed wealth tax could reduce unequal treatment and fund public investments without burdening ordinary savings.",
      question: "How should the tax system treat vast gains in ability to pay that may never appear as ordinary income?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "Annual wealth taxation is difficult to value, enforce, and separate from productive investment",
      summary: "Critics argue that private businesses, property, and intellectual assets lack clear yearly prices, that taxpayers may be forced to sell illiquid assets, and that avoidance, capital flight, litigation, and reduced investment could yield less revenue than promised.",
      question: "Why create a difficult new tax base if existing income, estate, and capital-gains rules can be strengthened?",
    },
    shared: ["A tax system people view as legitimate", "Strong investment and broad economic opportunity", "Rules wealthy taxpayers cannot easily avoid"],
    evidence: ["Revenue and avoidance in jurisdictions using wealth taxes", "Valuation and liquidity challenges across asset types", "Comparison with capital-gains-at-death, estate, property, and minimum-income taxes"],
    people: ["Households holding extreme concentrations of wealth", "Workers and communities affected by public investment", "Entrepreneurs, family businesses, investors, and tax administrators"],
    options: ["Annual net-wealth tax above a high threshold", "Minimum tax on gains with deferral rules for illiquid assets", "Stronger estate, capital-gains, enforcement, and anti-avoidance rules"],
  },
];

const LENSES: Array<{ key: LensKey; label: string; icon: typeof Handshake }> = [
  { key: "shared", label: "Shared ground", icon: Handshake },
  { key: "evidence", label: "Evidence to test", icon: BookOpenCheck },
  { key: "people", label: "Who feels the impact", icon: Users },
  { key: "options", label: "Policy paths", icon: GitBranch },
];

export function ChallengeMyViewExplorer({ communityTopics = [] }: { communityTopics?: ChallengeTopic[] }) {
  const topics = [...TOPICS, ...communityTopics];
  const [topicId, setTopicId] = useState(topics[0].id);
  const [stance, setStance] = useState<Stance | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [activeLens, setActiveLens] = useState<LensKey>("shared");
  const [reflection, setReflection] = useState<string | null>(null);
  const topic = topics.find((entry) => entry.id === topicId) ?? topics[0];

  const perspectives = stance === "agree" ? [topic.caseAgainst] : stance === "disagree" ? [topic.caseFor] : [topic.caseFor, topic.caseAgainst];
  const lensItems = topic[activeLens];

  function selectTopic(id: string) {
    setTopicId(id);
    setStance(null);
    setRevealed(false);
    setActiveLens("shared");
    setReflection(null);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/explore" className={styles.backLink}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Explore</Link>
        <div className={styles.brandMark}><Sparkles className="h-4 w-4" aria-hidden="true" /></div>
        <div>
          <p className={styles.eyebrow}>Perspective lab</p>
          <h1>Challenge my view</h1>
          <p>Choose a statement. Take a position. Then meet the strongest case you may be missing.</p>
        </div>
      </header>

      <main className={styles.main}>
        <nav aria-label="Choose a statement" className={styles.topicRail}>
          {topics.map((entry) => (
            <button key={entry.id} type="button" onClick={() => selectTopic(entry.id)} aria-pressed={topic.id === entry.id} className={topic.id === entry.id ? styles.topicActive : styles.topicButton}>
              {entry.category}{entry.communityAdded ? " · Community" : ""}
            </button>
          ))}
        </nav>

        <section className={styles.claimStage} aria-labelledby="selected-claim">
          <div className={styles.claimGlow} aria-hidden="true" />
          <p className={styles.stepLabel}>1 · Consider the statement</p>
          <h2 id="selected-claim">“{topic.statement}”</h2>
          <p className={styles.context}>{topic.context}</p>

          <div className={styles.stanceRow} aria-label="Your current position">
            {([
              ["agree", "Lean agree"],
              ["unsure", "Not sure"],
              ["disagree", "Lean disagree"],
            ] as Array<[Stance, string]>).map(([value, label]) => (
              <button key={value} type="button" onClick={() => { setStance(value); setRevealed(false); setReflection(null); }} aria-pressed={stance === value} className={stance === value ? styles.stanceActive : styles.stanceButton}>
                {label}
              </button>
            ))}
          </div>

          {stance ? (
            <button type="button" className={styles.revealButton} onClick={() => setRevealed(true)}>
              {stance === "unsure" ? "See the strongest cases" : "Challenge my view"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : <p className={styles.prompt}>Choose your current leaning. Nothing is posted publicly.</p>}
        </section>

        {revealed ? (
          <section className={styles.webStage} aria-live="polite">
            <div className={styles.connector} aria-hidden="true" />
            <p className={styles.stepLabel}>2 · Turn the issue</p>
            <div className={perspectives.length === 2 ? styles.perspectiveGrid : styles.perspectiveSingle}>
              {perspectives.map((perspective) => (
                <article key={perspective.headline} className={styles.perspectiveCard}>
                  <p>{perspective.label}</p>
                  <h3>{perspective.headline}</h3>
                  <p>{perspective.summary}</p>
                  <blockquote>{perspective.question}</blockquote>
                </article>
              ))}
            </div>

            <div className={styles.lensWeb}>
              <div className={styles.lensButtons}>
                {LENSES.map((lens) => {
                  const Icon = lens.icon;
                  return (
                    <button key={lens.key} type="button" onClick={() => setActiveLens(lens.key)} aria-pressed={activeLens === lens.key} className={activeLens === lens.key ? styles.lensActive : styles.lensButton}>
                      <Icon className="h-4 w-4" aria-hidden="true" /> {lens.label}
                    </button>
                  );
                })}
              </div>
              <div className={styles.lensDetail}>
                <div className={styles.lensIcon}>{activeLens === "shared" ? <Handshake /> : activeLens === "evidence" ? <BookOpenCheck /> : activeLens === "people" ? <Heart /> : <Scale />}</div>
                <div>
                  <p>{LENSES.find((lens) => lens.key === activeLens)?.label}</p>
                  <ul>{lensItems.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </div>
            </div>

            <div className={styles.reflection}>
              <p className={styles.stepLabel}>3 · What did the challenge do?</p>
              <div>
                {["Changed my view", "Made it more nuanced", "I understand but disagree", "I need better evidence"].map((option) => (
                  <button key={option} type="button" onClick={() => setReflection(option)} aria-pressed={reflection === option}>{option}</button>
                ))}
              </div>
              {reflection ? <p className={styles.savedReflection}>Your private reflection: <strong>{reflection}</strong></p> : null}
            </div>
          </section>
        ) : null}

        <footer className={styles.footerNote}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <p>These are moderated steelman summaries, not party scripts. Evidence can be incomplete, and some questions have more than two defensible perspectives.</p>
        </footer>
      </main>
    </div>
  );
}
