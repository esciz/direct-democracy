import { NextResponse } from "next/server";

import { getCurrentSessionUser } from "@/lib/server/auth-session";
import {
  ProfileMediaUploadError,
  storeProfileMedia,
  validateProfileMediaUpload,
} from "@/lib/profile/media-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentSessionUser();

  if (!currentUser) {
    return errorResponse("unauthorized", "Sign in again before uploading profile media.", 401);
  }

  try {
    const formData = await request.formData();
    const kind = formData.get("kind");

    if (kind !== "profile" && kind !== "banner") {
      return errorResponse("media-storage", "Choose whether this is a profile photo or cover photo.");
    }

    const media = await validateProfileMediaUpload(formData.get("file"));

    if (!media) {
      return errorResponse("media-format", "Choose a JPEG, PNG, or WebP image.");
    }

    const url = await storeProfileMedia(currentUser.id, kind, media);
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    const code = error instanceof ProfileMediaUploadError ? error.code : "media-storage";
    const message =
      code === "media-format"
        ? "That file is not a supported image. Choose a JPEG, PNG, or WebP."
        : code === "media-size"
          ? "That image is too large. Choose a file that is 5 MB or smaller."
          : "The image could not be saved right now.";

    return errorResponse(code, message);
  }
}
