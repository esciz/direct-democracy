"use client";

import Link from "next/link";
import { useState } from "react";

import type { ContactMethod, ContactOfficialsPanelSummary } from "@/types/domain";

type ContactOfficialsPanelProps = {
  panel: ContactOfficialsPanelSummary;
};

function buildMailto(email: string, subject: string, body: string) {
  const params = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:${email}?${params.toString()}`;
}

function buildTel(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

function getContactActionActivityLabel(method: ContactMethod) {
  if (method === "email") {
    return "emailed";
  }

  if (method === "phone") {
    return "called";
  }

  return "used the contact form for";
}

export function ContactOfficialsPanel({ panel }: ContactOfficialsPanelProps) {
  const [message, setMessage] = useState(panel.defaultMessage);

  async function logContactAction(officialId: string, method: ContactMethod) {
    try {
      await fetch("/api/contact-actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entityId: panel.entityId,
          entityType: panel.entityType,
          officialId,
          method,
        }),
        keepalive: true,
      });
    } catch {
      // Best-effort logging only. Contact actions must still open reliably.
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Contact Your Representative</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Turn this issue into real outreach</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            User-initiated outreach only. This tool helps you contact relevant offices with constructive talking points, but it does not send
            anything automatically.
          </p>
        </div>
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
          {panel.actionCount} people here have taken action
        </span>
      </div>

      <div className="mt-5 rounded-3xl border border-civic-100 bg-civic-50/70 p-5 text-sm text-civic-900">
        <p className="font-semibold">Suggested talking points</p>
        <ul className="mt-3 space-y-2 text-sm leading-6">
          {panel.talkingPoints.map((point) => (
            <li key={point}>• {point}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs uppercase tracking-[0.16em] text-civic-700">
          Keep it constructive. No mass automation, no abusive language, and no impersonation.
        </p>
      </div>

      <div className="mt-6">
        <label htmlFor="contact-message" className="text-sm font-semibold text-ink">
          Editable message template
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={7}
          className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner outline-none transition focus:border-civic-500 focus:ring-2 focus:ring-civic-200"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {panel.officials.length ? (
          panel.officials.map((official) => (
            <article key={official.officialId} className="rounded-3xl bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {official.officeTitle}
                </span>
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{official.jurisdictionName}</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold text-ink">{official.name}</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {official.email ? <p>Email: {official.email}</p> : null}
                {official.phone ? <p>Phone: {official.phone}</p> : null}
                {official.officialFormUrl ? <p>Official form available</p> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {official.email ? (
                  <a
                    href={buildMailto(official.email, panel.defaultSubject, message)}
                    onClick={() => {
                      void logContactAction(official.officialId, "email");
                    }}
                    className="inline-flex rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700"
                  >
                    Email
                  </a>
                ) : null}
                {official.phone ? (
                  <a
                    href={buildTel(official.phone)}
                    onClick={() => {
                      void logContactAction(official.officialId, "phone");
                    }}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                  >
                    Call office
                  </a>
                ) : null}
                {official.officialFormUrl ? (
                  <a
                    href={official.officialFormUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      void logContactAction(official.officialId, "form");
                    }}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                  >
                    Open official form
                  </a>
                ) : null}
                <Link
                  href={official.officialProfileHref}
                  className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                >
                  View profile
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600 xl:col-span-2">
            No relevant official contact routes are seeded for this context yet.
          </div>
        )}
      </div>

      {panel.recentActions.length ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-ink">Recent community action</p>
          <div className="mt-3 space-y-3">
            {panel.recentActions.map((action) => (
              <p key={`${action.userName}-${action.createdAt}-${action.officialName}`} className="text-sm text-slate-600">
                <span className="font-semibold text-ink">{action.userName}</span> {getContactActionActivityLabel(action.method)}{" "}
                <span className="font-semibold text-ink">{action.officialName}</span>{" "}
                <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  {new Date(action.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
