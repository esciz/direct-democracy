"use client";

import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { submitQuickVoteInline } from "@/lib/feed/vote-actions";
import { extractTaxCostContext, stripTaxCostContext } from "@/lib/public-meetings/financial-impact";
import { getResultComparisonText, getVoteObjectLabel, getVoteParticipationPrompt, getVoteResponseLabels } from "@/lib/votes/presentation";
import type { VoteQuestionCardSummary } from "@/types/domain";

type VoteCardProps = {
  question: VoteQuestionCardSummary;
  compact?: boolean;
  returnPath?: string;
  canAnswer?: boolean;
  onVoteRecorded?: (question: VoteQuestionCardSummary) => void;
  onAdvance?: () => void;
  autoAdvance?: boolean;
};

const optionStyles = {
  yes:
    "border-emerald-300/24 bg-[linear-gradient(135deg,rgba(6,95,70,0.42),rgba(5,46,22,0.58))] text-emerald-100 shadow-[0_18px_38px_-24px_rgba(16,185,129,0.55)] hover:border-emerald-300/40 hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-24px_rgba(16,185,129,0.58)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40",
  no:
    "border-rose-300/20 bg-[linear-gradient(135deg,rgba(127,29,29,0.42),rgba(76,5,25,0.58))] text-rose-100 shadow-[0_18px_38px_-24px_rgba(244,63,94,0.42)] hover:border-rose-300/36 hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-24px_rgba(244,63,94,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/35",
  skip:
    "border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(8,15,28,0.96))] text-slate-200 shadow-[0_16px_32px_-24px_rgba(2,8,23,0.7)] hover:border-white/18 hover:-translate-y-0.5 hover:bg-[rgba(15,23,42,0.92)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/30",
} as const;

const resultBarStyles = {
  yes: "bg-emerald-500",
  no: "bg-rose-500",
  skip: "bg-slate-400",
} as const;

const voteTypeLabels = {
  representativeVote: "Weekly sentiment",
  legislation: "Legislation",
  ballotMeasure: "Ballot measure",
  agendaItem: "Agenda item",
  schoolBoardDecision: "School board decision",
  executiveAction: "Executive action",
  caseVote: "Case vote",
  publicVote: "Public vote",
  citizenElevatedVote: "Citizen-elevated vote",
} as const;

function getStatusLabel(status: VoteQuestionCardSummary["status"]) {
  if (!status) {
    return "Active";
  }

  return status.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function getVoteAvatarType(question: VoteQuestionCardSummary) {
  if (question.referenceCaseId) {
    return "case";
  }

  if (question.objectType === "representative") {
    return "official";
  }

  if (question.objectType === "community") {
    return "community";
  }

  return "issue";
}

function pendingText(text = "Plain-English summary pending review.") {
  return <span className="text-slate-500">{text}</span>;
}

function ContextItem({
  label,
  children,
  tone = "default",
}: {
  label: string;
  children?: ReactNode;
  tone?: "default" | "yes" | "no" | "financial" | "neutral";
}) {
  const toneClasses =
    tone === "yes"
      ? "border-emerald-300/16 bg-emerald-500/10 text-emerald-100"
      : tone === "no"
        ? "border-rose-300/16 bg-rose-500/10 text-rose-100"
        : tone === "financial"
          ? "border-amber-300/18 bg-amber-500/10 text-amber-50"
          : tone === "neutral"
            ? "border-cyan-300/16 bg-cyan-500/10 text-cyan-50"
            : "border-white/10 bg-white/[0.04] text-slate-300";
  const labelClasses =
    tone === "yes"
      ? "text-emerald-200"
      : tone === "no"
        ? "text-rose-200"
        : tone === "financial"
          ? "text-amber-200"
          : tone === "neutral"
            ? "text-cyan-200"
            : "text-slate-500";

  return (
    <div className={`rounded-3xl border px-4 py-4 ${toneClasses}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${labelClasses}`}>{label}</p>
      <div className="mt-2 text-sm leading-6">{children ?? pendingText()}</div>
    </div>
  );
}

function TextList({ items, fallback }: { items?: string[]; fallback: string }) {
  const cleanItems = items?.filter(Boolean) ?? [];

  if (!cleanItems.length) {
    return pendingText(fallback);
  }

  return (
    <ul className="space-y-2">
      {cleanItems.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SourceLinks({ question }: { question: VoteQuestionCardSummary }) {
  const sourceLinks = question.sourceLinks?.length
    ? question.sourceLinks
    : question.sourceUrl
      ? [{ label: question.sourceName ?? "Imported public civic data", url: question.sourceUrl }]
      : [];

  if (!sourceLinks.length) {
    return pendingText("Source URL pending review.");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {sourceLinks.map((source) => (
          <a
            key={`${source.label}-${source.url}`}
            href={source.url}
            className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:text-cyan-50"
            rel="noreferrer"
            target="_blank"
          >
            {source.label}
          </a>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        {question.sourceLastUpdated ? <span>Updated {new Date(question.sourceLastUpdated).toLocaleDateString()}</span> : null}
        {typeof question.confidenceScore === "number" ? <span>Confidence {(question.confidenceScore * 100).toFixed(0)}%</span> : null}
      </div>
    </div>
  );
}

function getContextKind(question: VoteQuestionCardSummary) {
  if (question.questionType === "BALLOT_MEASURE_DECISION") return "ballotMeasure";
  if (question.questionType === "LEGISLATION_DECISION") return "legislation";
  if (question.questionType === "CANDIDATE_PERFORMANCE" || question.questionType === "ELECTED_OFFICIAL_PERFORMANCE") return "person";
  if (question.questionType === "COMMUNITY_PRIORITY_POLL") return "priority";
  if (question.voteType === "ballotMeasure") return "ballotMeasure";
  if (question.voteType === "legislation") return "legislation";
  if (question.objectType === "representative" && question.voteType !== "publicVote") return "person";
  return "issue";
}

function formatAnswerMeaning(label: string, fallback?: string | null) {
  return fallback ?? pendingText(`${label} effect summary pending review.`);
}

function ContextDetails({
  question,
  responseLabels,
}: {
  question: VoteQuestionCardSummary;
  responseLabels: ReturnType<typeof getVoteResponseLabels>;
}) {
  const contextKind = getContextKind(question);
  const affectedGroups = question.affectedGroups?.length ? question.affectedGroups.join(", ") : question.whoIsAffected;
  const taxCostImpact = extractTaxCostContext(question.contextSummary) ?? question.fiscalImpactSummary;
  const plainContextSummary = stripTaxCostContext(question.contextSummary);

  if (contextKind === "person") {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <ContextItem label="Current office / race">{question.officialBody ?? question.shortTitle ?? pendingText("Office or race not found in source data yet.")}</ContextItem>
          <ContextItem label="Jurisdiction">{question.jurisdictionName}</ContextItem>
          <ContextItem label="Plain English bio">
            {question.contextSummary ?? question.plainLanguageSummary ?? question.subjectName ?? pendingText("Source-backed bio not found yet.")}
          </ContextItem>
          <ContextItem label="Key responsibilities">
            {question.officialBody
              ? `${question.officialBody} responsibilities affect ${question.jurisdictionName} residents through public decisions, budgets, services, and oversight.`
              : pendingText("Office responsibilities pending source review.")}
          </ContextItem>
          <ContextItem label="Voting record / public actions">
            {question.officialPositionSummary ?? question.officialVoteSummary ?? pendingText("No source-backed voting record or public action summary found yet.")}
          </ContextItem>
          <ContextItem label="Campaign finance / donor context">
            {pendingText("No source-backed campaign finance summary is attached to this vote question yet.")}
          </ContextItem>
          <ContextItem label="News, accomplishments, and criticism">
            {pendingText("No cited news sentiment, public controversy, or accomplishment summary is attached yet.")}
          </ContextItem>
          <ContextItem label="Neutral performance summary" tone="neutral">
            {question.neutralDecisionSummary ??
              "Use this vote to record your current performance signal. The card shows only source-backed context when available and does not rely on unexplained raw sentiment scores."}
          </ContextItem>
        </div>
      </>
    );
  }

  if (contextKind === "priority") {
    return (
      <>
        <ContextItem label="Plain English summary">{question.contextSummary ?? question.plainLanguageSummary ?? pendingText()}</ContextItem>
        <ContextItem label="Priority choices" tone="neutral">
          <TextList items={question.priorityOptions ?? [responseLabels.yes, responseLabels.no, responseLabels.skip]} fallback="Priority options pending review." />
        </ContextItem>
        <ContextItem label="How to use this question">
          This is a priority poll, not a support-or-oppose vote. Pick the issue area that best reflects what you want officials, candidates, media, and community groups to pay attention to.
        </ContextItem>
      </>
    );
  }

  if (contextKind === "ballotMeasure") {
    return (
      <>
        <ContextItem label="Plain English summary">{question.plainLanguageSummary ?? question.contextSummary ?? pendingText()}</ContextItem>
        <div className="grid gap-3 sm:grid-cols-2">
          <ContextItem label="What voting YES would do" tone="yes">
            {formatAnswerMeaning("YES", question.yesEffectSummary ?? question.whatYesMeans)}
          </ContextItem>
          <ContextItem label="What voting NO would do" tone="no">
            {formatAnswerMeaning("NO", question.noEffectSummary ?? question.whatNoMeans)}
          </ContextItem>
        </div>
        <ContextItem label="Nonpartisan financial impact" tone="financial">
          {question.fiscalImpactSummary ?? "No official fiscal note found yet."}
        </ContextItem>
        <ContextItem label="Who / what is affected">{affectedGroups ?? pendingText("Affected entities pending source review.")}</ContextItem>
        <div className="grid gap-3 sm:grid-cols-2">
          <ContextItem label="Arguments from supporters" tone="yes">
            <TextList items={question.supporterArguments} fallback="No source-backed supporter arguments are attached yet." />
          </ContextItem>
          <ContextItem label="Arguments from opponents" tone="no">
            <TextList items={question.opponentArguments} fallback="No source-backed opponent arguments are attached yet." />
          </ContextItem>
        </div>
        <ContextItem label="Historical context">{question.historicalContext ?? pendingText("Historical context pending source review.")}</ContextItem>
        <ContextItem label="Neutral decision summary" tone="neutral">
          {question.neutralDecisionSummary ??
            "Compare what changes under YES with what remains under NO, then weigh fiscal uncertainty, governance tradeoffs, and source-backed arguments."}
        </ContextItem>
      </>
    );
  }

  if (contextKind === "legislation") {
    return (
      <>
        <ContextItem label="Plain English summary">{question.contextSummary ?? question.plainLanguageSummary ?? pendingText("Bill summary pending source review.")}</ContextItem>
        <div className="grid gap-3 sm:grid-cols-2">
          <ContextItem label="Sponsor">{question.introducedBy ?? pendingText("Sponsor not found in source data yet.")}</ContextItem>
          <ContextItem label="Chamber / body">{question.officialBody ?? pendingText("Legislative body pending source review.")}</ContextItem>
          <ContextItem label="Voting record / public action">
            {question.officialVoteSummary ?? pendingText("Official vote summary not found in source data yet.")}
          </ContextItem>
          <ContextItem label="Who / what is affected">{affectedGroups ?? pendingText("Affected groups pending source review.")}</ContextItem>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ContextItem label={`${responseLabels.yes} means`} tone="yes">
            {question.yesEffectSummary ?? `A ${responseLabels.yes.toLowerCase()} answer records your platform sentiment in favor of this bill or legislative vote.`}
          </ContextItem>
          <ContextItem label={`${responseLabels.no} means`} tone="no">
            {question.noEffectSummary ?? `A ${responseLabels.no.toLowerCase()} answer records your platform sentiment against this bill or legislative vote.`}
          </ContextItem>
        </div>
        {question.fiscalImpactSummary ? (
          <ContextItem label="Nonpartisan financial impact" tone="financial">
            {question.fiscalImpactSummary}
          </ContextItem>
        ) : null}
        <ContextItem label="Neutral decision summary" tone="neutral">
          {question.neutralDecisionSummary ?? "Review what the bill does, who sponsored it, the vote record if available, affected groups, and source links before recording your signal."}
        </ContextItem>
      </>
    );
  }

  return (
    <>
      <ContextItem label="Plain English summary">{plainContextSummary ?? question.plainLanguageSummary ?? pendingText()}</ContextItem>
      {taxCostImpact ? (
        <ContextItem label="Tax / cost impact" tone="financial">
          {taxCostImpact}
        </ContextItem>
      ) : null}
      <ContextItem label="Why it matters locally">{question.whyItMatters ?? pendingText("Local impact summary pending review.")}</ContextItem>
      <ContextItem label="Related officials / candidates / elections">
        {[question.subjectName, question.relatedIssueLabel, affectedGroups].filter(Boolean).join(" · ") || pendingText("Related civic records pending review.")}
      </ContextItem>
      <div className="grid gap-3 sm:grid-cols-2">
        <ContextItem label={`${responseLabels.yes} means`} tone="yes">
          {formatAnswerMeaning(responseLabels.yes, question.yesEffectSummary ?? question.whatYesMeans)}
        </ContextItem>
        <ContextItem label={`${responseLabels.no} means`} tone="no">
          {formatAnswerMeaning(responseLabels.no, question.noEffectSummary ?? question.whatNoMeans)}
        </ContextItem>
      </div>
    </>
  );
}

function getOptionSubLabels(question: VoteQuestionCardSummary) {
  if (question.questionType === "BALLOT_MEASURE_DECISION") return { yes: "yes", no: "no", skip: "undecided" };
  if (question.questionType === "LEGISLATION_DECISION") return { yes: "support", no: "oppose", skip: "undecided" };
  if (question.questionType === "CANDIDATE_PERFORMANCE" || question.questionType === "ELECTED_OFFICIAL_PERFORMANCE") {
    return { yes: "approve", no: "disapprove", skip: "unsure" };
  }
  if (question.questionType === "COMMUNITY_PRIORITY_POLL") return { yes: "priority", no: "priority", skip: "another" };

  return { yes: "support", no: "oppose", skip: "neutral" };
}

export function VoteCard({
  question,
  compact = false,
  returnPath = "/my-community",
  canAnswer = true,
  onVoteRecorded,
  onAdvance,
  autoAdvance = false,
}: VoteCardProps) {
  const [currentQuestion, setCurrentQuestion] = useState(question);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [isEditingVote, setIsEditingVote] = useState(false);
  const [isPending, startTransition] = useTransition();
  const responseLabels = getVoteResponseLabels(currentQuestion);
  const optionSubLabels = getOptionSubLabels(currentQuestion);
  const comparisonText = getResultComparisonText(currentQuestion);
  const contextPreview =
    currentQuestion.contextSummary ??
    currentQuestion.plainLanguageSummary ??
    currentQuestion.officialPositionSummary ??
    currentQuestion.officialVoteSummary ??
    null;

  useEffect(() => {
    setCurrentQuestion(question);
    setMessage(null);
    setError(null);
    setShowContext(false);
    setIsEditingVote(false);
  }, [question]);

  const showResults = Boolean(currentQuestion.userAnswer);
  const canShowChangeVote = Boolean(currentQuestion.userAnswer && currentQuestion.canChangeVote && currentQuestion.votingPeriodStatus === "open");
  const isVotingClosed = currentQuestion.votingPeriodStatus === "closed";

  function handleVote(answer: "yes" | "no" | "skip") {
    if (!canAnswer || isPending || (showResults && !isEditingVote)) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await submitQuickVoteInline({
        questionId: currentQuestion.id,
        answer,
      });

      if (!result.ok || !result.question) {
        setError(result.message ?? "That vote could not be recorded. Please try again.");
        return;
      }

      setCurrentQuestion(result.question);
      setMessage(result.message ?? "Vote recorded.");
      setIsEditingVote(false);
      onVoteRecorded?.(result.question);
    });
  }

  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(165deg,rgba(11,21,37,0.98),rgba(6,12,24,0.98))] p-6 shadow-[0_34px_72px_-40px_rgba(2,8,23,0.96)] backdrop-blur">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#34d399,#22d3ee,#818cf8)]" />
      <div className="relative flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
          {getVoteObjectLabel(currentQuestion)}
        </span>
        {currentQuestion.onboardingPosition && currentQuestion.onboardingTotal ? (
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
            Vote {currentQuestion.onboardingPosition} of {currentQuestion.onboardingTotal}
          </span>
        ) : null}
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
          {voteTypeLabels[currentQuestion.voteType ?? "publicVote"]}
        </span>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
          {getStatusLabel(currentQuestion.status)}
        </span>
        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold text-slate-300">
          {currentQuestion.communityLabel ?? currentQuestion.jurisdictionName}
        </span>
        {currentQuestion.relatedIssueLabel ? (
          <span className="rounded-full border border-emerald-300/18 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            {currentQuestion.relatedIssueLabel}
          </span>
        ) : null}
        {currentQuestion.realDataBadge ? (
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Real data
          </span>
        ) : null}
      </div>

      {currentQuestion.subjectName ? (
        <div className="relative mt-4 flex items-center gap-3">
          <CivicAvatar
            name={currentQuestion.subjectName}
            entityType={getVoteAvatarType(currentQuestion)}
            size="sm"
            verified={currentQuestion.objectType === "representative"}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Currently voting on</p>
            <p className="mt-1 text-sm font-semibold text-slate-200">{currentQuestion.subjectName}</p>
          </div>
        </div>
      ) : null}
      {currentQuestion.shortTitle ? (
        <p className="relative mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{currentQuestion.shortTitle}</p>
      ) : null}
      <h2 className={`relative mt-4 font-semibold tracking-tight text-slate-50 ${compact ? "text-xl" : "text-[1.95rem] leading-tight"}`}>
        {currentQuestion.questionText}
      </h2>
      <p className="relative mt-3 text-sm font-medium text-emerald-200">{getVoteParticipationPrompt(currentQuestion)}</p>
      {(currentQuestion.sourceName || currentQuestion.sourceUrl) ? (
        <div className="relative mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
            Source: {currentQuestion.sourceName ?? "Imported public civic data"}
          </span>
          {currentQuestion.sourceLastUpdated ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Updated {new Date(currentQuestion.sourceLastUpdated).toLocaleDateString()}
            </span>
          ) : null}
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{currentQuestion.jurisdictionName}</span>
          {typeof currentQuestion.confidenceScore === "number" ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Confidence {(currentQuestion.confidenceScore * 100).toFixed(0)}%
            </span>
          ) : null}
          {currentQuestion.sourceUrl ? (
            <a
              href={currentQuestion.sourceUrl}
              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-cyan-100 hover:text-cyan-50"
              rel="noreferrer"
              target="_blank"
            >
              View source
            </a>
          ) : null}
        </div>
      ) : null}
      {contextPreview ? (
        <div className="relative mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Why this matters</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{contextPreview}</p>
        </div>
      ) : null}

      {showResults && !isEditingVote ? (
        <div className="relative mt-5 space-y-3">
          {comparisonText ? <p className="text-sm text-slate-400">{comparisonText}</p> : null}
          <div className="rounded-[1.5rem] border border-emerald-300/16 bg-[linear-gradient(135deg,rgba(6,95,70,0.28),rgba(8,15,28,0.88))] p-4 text-sm text-slate-200">
            <span className="font-semibold text-emerald-200">Vote recorded:</span>{" "}
            {currentQuestion.userAnswer === "yes"
              ? responseLabels.yes
              : currentQuestion.userAnswer === "no"
                ? responseLabels.no
                : responseLabels.skip}
            {currentQuestion.voteUpdatedAt ? (
              <span className="text-slate-400"> · Updated {new Date(currentQuestion.voteUpdatedAt).toLocaleDateString()}</span>
            ) : null}
          </div>
          {(["yes", "no", "skip"] as const).map((answer) => (
            <div key={answer} className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center justify-between text-sm font-medium text-slate-300">
                <span>{answer === "yes" ? responseLabels.yes : answer === "no" ? responseLabels.no : responseLabels.skip}</span>
                <span>
                  {currentQuestion.results[answer]} votes · {currentQuestion.percentages[answer]}%
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/8">
                <div className={`h-1.5 rounded-full ${resultBarStyles[answer]}`} style={{ width: `${currentQuestion.percentages[answer]}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{currentQuestion.totalResponses} total responses</p>
          {isVotingClosed ? (
            <p className="text-sm text-slate-400">This voting period is closed.</p>
          ) : null}
          {canShowChangeVote ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setError(null);
                  setIsEditingVote(true);
                }}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/24 hover:text-emerald-100"
              >
                Change vote
              </button>
            </div>
          ) : null}
          {onAdvance ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={onAdvance}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                {autoAdvance ? "Next question" : "Continue"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative mt-5 space-y-3">
          {isEditingVote ? (
            <div className="rounded-[1.5rem] border border-cyan-300/16 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              Update your vote for this current voting period. Your earlier vote will be replaced, not duplicated.
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canAnswer || isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleVote("yes");
              }}
              className={`flex min-w-[12rem] flex-1 flex-col rounded-[1.35rem] border px-4 py-3.5 text-left text-sm font-semibold transition ${!canAnswer || isPending ? "cursor-not-allowed opacity-55" : ""} ${optionStyles.yes}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>{responseLabels.yes}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-emerald-200/80">{optionSubLabels.yes}</span>
              </span>
              <span className="mt-3 h-1.5 rounded-full bg-white/10">
                <span className="block h-1.5 w-[72%] rounded-full bg-emerald-300/70" />
              </span>
            </button>
            <button
              type="button"
              disabled={!canAnswer || isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleVote("no");
              }}
              className={`flex min-w-[12rem] flex-1 flex-col rounded-[1.35rem] border px-4 py-3.5 text-left text-sm font-semibold transition ${!canAnswer || isPending ? "cursor-not-allowed opacity-55" : ""} ${optionStyles.no}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>{responseLabels.no}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-rose-200/80">{optionSubLabels.no}</span>
              </span>
              <span className="mt-3 h-1.5 rounded-full bg-white/10">
                <span className="block h-1.5 w-[48%] rounded-full bg-rose-300/70" />
              </span>
            </button>
            <button
              type="button"
              disabled={!canAnswer || isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleVote("skip");
              }}
              className={`flex min-w-[12rem] flex-1 flex-col rounded-[1.35rem] border px-4 py-3.5 text-left text-sm font-semibold transition ${!canAnswer || isPending ? "cursor-not-allowed opacity-55" : ""} ${optionStyles.skip}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>{responseLabels.skip}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{optionSubLabels.skip}</span>
              </span>
              <span className="mt-3 h-1.5 rounded-full bg-white/10">
                <span className="block h-1.5 w-[28%] rounded-full bg-slate-300/40" />
              </span>
            </button>
          </div>
          {!canAnswer ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              Browse this question now. Voting unlocks after voter verification is complete.
            </div>
          ) : null}
          {isEditingVote ? (
            <div>
              <button
                type="button"
                onClick={() => setIsEditingVote(false)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/16"
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="relative mt-5 rounded-3xl border border-white/10 bg-white/[0.04]">
        <button
          type="button"
          onClick={() => setShowContext((value) => !value)}
          aria-expanded={showContext}
          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold text-slate-200 transition hover:text-cyan-100"
        >
          <span>More context</span>
          <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{showContext ? "Hide" : "View details"}</span>
        </button>
        {showContext ? (
          <div className="space-y-4 border-t border-white/10 px-4 pb-4 pt-4">
            <ContextDetails question={currentQuestion} responseLabels={responseLabels} />
            <ContextItem label="Source links">
              <SourceLinks question={currentQuestion} />
            </ContextItem>
          </div>
        ) : null}
      </div>

      {message ? <p className="mt-3 rounded-2xl border border-emerald-300/16 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100">✓ {message}</p> : null}
      {error ? <p className="mt-3 text-sm text-orange-200">{error}</p> : null}
    </article>
  );
}
