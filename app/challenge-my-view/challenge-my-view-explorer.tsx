"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenCheck, GitBranch, Handshake, Heart, RotateCcw, Scale, Sparkles, Users } from "lucide-react";
import { useState } from "react";

import styles from "./challenge-my-view.module.css";

type Stance = "agree" | "unsure" | "disagree";
type LensKey = "shared" | "evidence" | "people" | "options";

type Perspective = {
  label: string;
  headline: string;
  summary: string;
  question: string;
};

type ChallengeTopic = {
  id: string;
  category: string;
  statement: string;
  context: string;
  caseFor: Perspective;
  caseAgainst: Perspective;
  shared: string[];
  evidence: string[];
  people: string[];
  options: string[];
};

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
];

const LENSES: Array<{ key: LensKey; label: string; icon: typeof Handshake }> = [
  { key: "shared", label: "Shared ground", icon: Handshake },
  { key: "evidence", label: "Evidence to test", icon: BookOpenCheck },
  { key: "people", label: "Who feels the impact", icon: Users },
  { key: "options", label: "Policy paths", icon: GitBranch },
];

export function ChallengeMyViewExplorer() {
  const [topicId, setTopicId] = useState(TOPICS[0].id);
  const [stance, setStance] = useState<Stance | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [activeLens, setActiveLens] = useState<LensKey>("shared");
  const [reflection, setReflection] = useState<string | null>(null);
  const topic = TOPICS.find((entry) => entry.id === topicId) ?? TOPICS[0];

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
          {TOPICS.map((entry) => (
            <button key={entry.id} type="button" onClick={() => selectTopic(entry.id)} aria-pressed={topic.id === entry.id} className={topic.id === entry.id ? styles.topicActive : styles.topicButton}>
              {entry.category}
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
