import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { stagePublicMeetingUploadAction } from "@/lib/public-meetings/actions";
import { getPublicMeetingAdminDashboard } from "@/lib/public-meetings/public";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type AdminMeetingUploadPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function AdminMeetingUploadPage({ searchParams }: AdminMeetingUploadPageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }

  const params = searchParams ? await searchParams : {};
  const dashboard = await getPublicMeetingAdminDashboard();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Upload public meeting record"
        description="Stage an agenda, minutes file, staff report, packet, transcript, attachment, or vote record for local parsing. The parser runs separately with npm run meetings:import."
        actions={
          <Link href="/admin/meetings" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Back to review
          </Link>
        }
      />

      {params.error === "missing-file" ? (
        <section className="rounded-[1.35rem] border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
          Choose a PDF, HTML, or text document before staging the upload.
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Manual fallback</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">Workflow</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Upload the official source document, associate it with a public body and meeting date, then run <span className="font-mono text-xs">npm run meetings:import</span>. Low-confidence and draft records remain admin-only.
        </p>
      </section>

      <form action={stagePublicMeetingUploadAction} encType="multipart/form-data" className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Public body</span>
            <select name="public_body_id" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
              <option value="">Unmatched / choose later</option>
              {dashboard.publicBodies.map((body) => (
                <option key={body.id} value={body.id}>
                  {body.name} - {body.jurisdiction}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Seed source</span>
            <select name="source_id" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
              <option value="">Unmatched / choose later</option>
              {dashboard.seedSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Meeting date</span>
            <input name="meeting_date" type="date" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Meeting type</span>
            <input name="meeting_type" placeholder="Regular meeting" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Title</span>
            <input name="title" placeholder="Board of Supervisors regular meeting agenda" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Document type</span>
            <select name="document_type" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
              <option value="agenda">Agenda</option>
              <option value="minutes">Minutes</option>
              <option value="staff_report">Staff report</option>
              <option value="board_packet">Board packet</option>
              <option value="ordinance">Ordinance</option>
              <option value="resolution">Resolution</option>
              <option value="public_comment">Public comment</option>
              <option value="transcript">Transcript</option>
              <option value="roll_call_vote">Roll-call vote</option>
              <option value="attachment">Attachment / exhibit</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Document</span>
            <input name="document" type="file" accept=".pdf,.txt,.text,.html,.htm" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-300/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-100" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Source URL</span>
            <input name="source_url" type="url" placeholder="https://..." className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Notes</span>
            <textarea name="notes" rows={4} placeholder="Page number, agenda section, source caveats, OCR notes..." className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600" />
          </label>
        </div>
        <button type="submit" className="mt-5 dd-button-primary rounded-full px-5 py-3 text-sm font-semibold">
          Stage upload
        </button>
      </form>
    </div>
  );
}
