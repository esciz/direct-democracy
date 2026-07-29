"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw, Trash2 } from "lucide-react";

const MAX_PROFILE_MEDIA_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProfileMediaFieldsProps = {
  userName: string;
  profileImageUrl: string;
  bannerImageUrl: string;
  isBright: boolean;
};

function usePreviewUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return url;
}

function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

async function uploadProfileMedia(file: File, kind: "profile" | "banner") {
  const formData = new FormData();
  formData.set("kind", kind);
  formData.set("file", file);

  const response = await fetch("/api/profile-media", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; url?: string; message?: string } | null;

  if (!response.ok || !payload?.ok || typeof payload.url !== "string") {
    throw new Error(payload?.message || "The image could not be uploaded.");
  }

  return payload.url;
}

export function ProfileMediaFields({
  userName,
  profileImageUrl,
  bannerImageUrl,
  isBright,
}: ProfileMediaFieldsProps) {
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [removeBannerImage, setRemoveBannerImage] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const profileUrlInputRef = useRef<HTMLInputElement>(null);
  const bannerUrlInputRef = useRef<HTMLInputElement>(null);
  const bypassUploadRef = useRef(false);
  const profilePreviewUrl = usePreviewUrl(profileFile);
  const bannerPreviewUrl = usePreviewUrl(bannerFile);
  const visibleProfileUrl = removeProfileImage ? "" : profilePreviewUrl || profileImageUrl;
  const visibleBannerUrl = removeBannerImage ? "" : bannerPreviewUrl || bannerImageUrl;
  const hasPendingMediaChange =
    Boolean(profileFile || bannerFile) || removeProfileImage || removeBannerImage;

  useEffect(() => {
    const form = bannerInputRef.current?.form;
    if (!form) return;
    const profileForm = form;

    async function handleSubmit(event: SubmitEvent) {
      if (bypassUploadRef.current) {
        bypassUploadRef.current = false;
        return;
      }

      if (!profileFile && !bannerFile) return;

      event.preventDefault();
      setIsUploading(true);
      setMediaError("");

      try {
        const [profileUrl, bannerUrl] = await Promise.all([
          profileFile ? uploadProfileMedia(profileFile, "profile") : Promise.resolve(""),
          bannerFile ? uploadProfileMedia(bannerFile, "banner") : Promise.resolve(""),
        ]);

        if (profileUrlInputRef.current && profileUrl) {
          profileUrlInputRef.current.value = profileUrl;
        }

        if (bannerUrlInputRef.current && bannerUrl) {
          bannerUrlInputRef.current.value = bannerUrl;
        }

        if (profileInputRef.current) profileInputRef.current.value = "";
        if (bannerInputRef.current) bannerInputRef.current.value = "";
        setProfileFile(null);
        setBannerFile(null);
        bypassUploadRef.current = true;
        profileForm.requestSubmit(event.submitter instanceof HTMLElement ? event.submitter : undefined);
      } catch (error) {
        setMediaError(error instanceof Error ? error.message : "The image could not be uploaded.");
      } finally {
        setIsUploading(false);
      }
    }

    profileForm.addEventListener("submit", handleSubmit);
    return () => profileForm.removeEventListener("submit", handleSubmit);
  }, [bannerFile, profileFile]);

  function validateSelectedFile(file: File | null, input: HTMLInputElement, label: string) {
    if (!file) {
      setMediaError("");
      return null;
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      input.value = "";
      setMediaError(`${label} must be a JPEG, PNG, or WebP image.`);
      return null;
    }

    if (file.size > MAX_PROFILE_MEDIA_BYTES) {
      input.value = "";
      setMediaError(`${label} must be 5 MB or smaller.`);
      return null;
    }

    setMediaError("");
    return file;
  }

  function clearProfileImage() {
    setProfileFile(null);
    setRemoveProfileImage(true);
    setMediaError("");
    if (profileInputRef.current) profileInputRef.current.value = "";
  }

  function clearBannerImage() {
    setBannerFile(null);
    setRemoveBannerImage(true);
    setMediaError("");
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  }

  return (
    <section aria-labelledby="profile-photos-heading" className="border-b border-white/10 pb-8">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
            isBright
              ? "border-[#54d6d0]/30 bg-[#54d6d0]/10 text-[#8ceae6]"
              : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
          }`}
          aria-hidden="true"
        >
          <Camera size={18} strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Photos</p>
          <h3 id="profile-photos-heading" className="mt-1.5 text-lg font-semibold text-slate-100">
            Make the profile recognizable
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">JPEG, PNG, or WebP. Up to 5 MB per image.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
        <div>
          <p className="text-sm font-semibold text-slate-200">Profile photo</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/12 bg-slate-950 text-xl font-semibold text-slate-400">
              {visibleProfileUrl ? (
                <Image src={visibleProfileUrl} alt="" fill sizes="96px" unoptimized className="object-cover" />
              ) : (
                <span aria-hidden="true">{initialsForName(userName) || "DD"}</span>
              )}
            </div>
            <div className="min-w-0">
              <input
                ref={profileInputRef}
                id="profileImageFile"
                name="profileImageFile"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = validateSelectedFile(event.target.files?.[0] ?? null, event.currentTarget, "Profile photo");
                  setProfileFile(file);
                  if (file) setRemoveProfileImage(false);
                }}
              />
              <label
                htmlFor="profileImageFile"
                className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-950 transition ${
                  isBright ? "bg-[#ff8a70] hover:bg-[#ff9c86]" : "bg-cyan-300 hover:bg-cyan-200"
                }`}
              >
                {visibleProfileUrl ? <RefreshCw size={16} aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
                {visibleProfileUrl ? "Change photo" : "Add photo"}
              </label>
              {visibleProfileUrl ? (
                <button
                  type="button"
                  onClick={clearProfileImage}
                  className="ml-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-rose-200"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Remove
                </button>
              ) : null}
              {profileFile ? <p className="mt-2 truncate text-xs text-slate-500">{profileFile.name}</p> : null}
            </div>
          </div>
          <input type="hidden" name="removeProfileImage" value={removeProfileImage ? "true" : "false"} />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-200">Cover photo</p>
          <div className="mt-3 overflow-hidden rounded-lg border border-white/12 bg-slate-950">
            <div className="relative flex aspect-[16/5] items-center justify-center text-sm text-slate-500">
              {visibleBannerUrl ? (
                <Image src={visibleBannerUrl} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" unoptimized className="object-cover" />
              ) : (
                <span>No cover photo</span>
              )}
            </div>
            <div className="flex min-h-14 flex-wrap items-center gap-3 border-t border-white/10 px-3 py-2.5">
              <input
                ref={bannerInputRef}
                id="bannerImageFile"
                name="bannerImageFile"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = validateSelectedFile(event.target.files?.[0] ?? null, event.currentTarget, "Cover photo");
                  setBannerFile(file);
                  if (file) setRemoveBannerImage(false);
                }}
              />
              <label
                htmlFor="bannerImageFile"
                className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-white/[0.05] px-3.5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.08] ${
                  isBright ? "border-[#ffd166]/30 hover:border-[#ffd166]/60" : "border-white/12 hover:border-cyan-300/30"
                }`}
              >
                {visibleBannerUrl ? <RefreshCw size={16} aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
                {visibleBannerUrl ? "Change cover" : "Add cover"}
              </label>
              {visibleBannerUrl ? (
                <button
                  type="button"
                  onClick={clearBannerImage}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-rose-200"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Remove
                </button>
              ) : null}
              {bannerFile ? <p className="min-w-0 flex-1 truncate text-xs text-slate-500">{bannerFile.name}</p> : null}
            </div>
          </div>
          <input type="hidden" name="removeBannerImage" value={removeBannerImage ? "true" : "false"} />
        </div>
      </div>

      {mediaError ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-50"
        >
          {mediaError}
        </div>
      ) : null}

      {hasPendingMediaChange ? (
        <div
          role="status"
          className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
            isBright
              ? "border-[#ffd166]/35 bg-[#ffd166]/10 text-[#ffe29a]"
              : "border-amber-300/30 bg-amber-300/10 text-amber-100"
          }`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
          {isUploading ? "Uploading photos..." : "Photo changes are ready. Select “Save all changes” to publish them."}
        </div>
      ) : null}
      <input ref={profileUrlInputRef} type="hidden" name="uploadedProfileImageUrl" />
      <input ref={bannerUrlInputRef} type="hidden" name="uploadedBannerImageUrl" />
    </section>
  );
}
