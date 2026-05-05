"use client";

import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";

import { createRepost } from "@/lib/share/actions";
import { buildSharePostHref, getShareEntityLabel, type ShareTargetSummary } from "@/lib/share/targets";
import { ActionLabel, MegaphoneIcon, ShareIcon } from "@/components/ui/action-icons";

type ShareActionMenuProps = {
  target: ShareTargetSummary;
  returnPath?: string;
  guestMode?: boolean;
  className?: string;
  buttonLabel?: string;
  align?: "left" | "right";
  iconOnly?: boolean;
};

function actionButtonClass(className?: string) {
  return (
    className ??
    "inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
  );
}

function MenuRow({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-civic-50 text-civic-700">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ShareActionMenu({
  target,
  returnPath,
  guestMode = false,
  className,
  buttonLabel = "Share",
  align = "right",
  iconOnly = false,
}: ShareActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<null | "copied" | "shared">(null);
  const postHref = useMemo(() => buildSharePostHref(target), [target]);

  function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setStatus(null);
    setOpen((current) => !current);
  }

  function handleClose(event?: MouseEvent<HTMLElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    setOpen(false);
  }

  async function handleExternalShare() {
    const externalHref = `${window.location.origin}${target.href}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: target.title,
          text: `Direct Democracy · ${getShareEntityLabel(target.entityType)}`,
          url: externalHref,
        });
        setStatus("shared");
      } else {
        await navigator.clipboard.writeText(externalHref);
        setStatus("copied");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(externalHref);
        setStatus("copied");
      } catch {
        setStatus(null);
      }
    }
  }

  return (
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={handleToggle} className={actionButtonClass(className)}>
        {iconOnly ? <ShareIcon className="h-4 w-4" /> : <ActionLabel icon={<ShareIcon className="h-4 w-4" />}>{buttonLabel}</ActionLabel>}
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Close share menu" className="fixed inset-0 z-30 bg-transparent" onClick={handleClose} />
          <div
            onClick={(event) => event.stopPropagation()}
            className={`absolute z-40 mt-2 w-[21rem] rounded-[1.5rem] border border-white/70 bg-white/95 p-3 shadow-card backdrop-blur ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            <div className="px-1 pb-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Share</p>
              <p className="mt-1 text-sm text-slate-500">{target.title}</p>
              {guestMode ? (
                <p className="mt-2 text-xs text-slate-500">Guest Browse is read-only. You can still share this externally.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              {!guestMode ? (
                <>
                  <MenuRow
                    icon={<MegaphoneIcon className="h-4 w-4" />}
                    title="Post"
                    description="Write your own post about this item with your own framing and commentary."
                  >
                    <Link
                      href={postHref}
                      className="text-sm font-semibold text-civic-700 hover:text-civic-900"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpen(false);
                      }}
                    >
                      Open composer
                    </Link>
                  </MenuRow>
                  <MenuRow
                    icon={<ShareIcon className="h-4 w-4" />}
                    title="Re-post"
                    description="Amplify the original item inside Direct Democracy without creating a brand-new authored post."
                  >
                    <form action={createRepost}>
                      <input type="hidden" name="entityType" value={target.entityType} />
                      <input type="hidden" name="entityId" value={target.entityId} />
                      <input type="hidden" name="title" value={target.title} />
                      <input type="hidden" name="href" value={target.href} />
                      <input type="hidden" name="summary" value={target.summary ?? ""} />
                      <input type="hidden" name="issueTag" value={target.issueTag ?? ""} />
                      <input type="hidden" name="returnPath" value={returnPath ?? target.href} />
                      <button
                        type="submit"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpen(false);
                        }}
                        className="text-sm font-semibold text-civic-700 hover:text-civic-900"
                      >
                        Re-post inside Direct Democracy
                      </button>
                    </form>
                  </MenuRow>
                </>
              ) : null}
              <MenuRow
                icon={<ShareIcon className="h-4 w-4" />}
                title="Share externally"
                description="Copy a link or use your device’s share sheet when it is available."
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleExternalShare();
                  }}
                  className="text-sm font-semibold text-civic-700 hover:text-civic-900"
                >
                  {typeof navigator !== "undefined" && "share" in navigator ? "Open share sheet" : "Copy link"}
                </button>
                {status ? (
                  <p className="mt-2 text-xs font-medium text-slate-500">{status === "shared" ? "Share sheet opened." : "Link copied."}</p>
                ) : null}
              </MenuRow>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
