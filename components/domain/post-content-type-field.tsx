"use client";

import { useId, useState } from "react";

type PostContentTypeFieldProps = {
  isMediaUser?: boolean;
};

export function PostContentTypeField({ isMediaUser = false }: PostContentTypeFieldProps) {
  const [value, setValue] = useState(isMediaUser ? "newsStory" : "announcementUpdate");
  const helpId = useId();

  if (isMediaUser) {
    return (
      <div>
        <label htmlFor="contentType" className="text-sm font-semibold text-ink">
          Content type
        </label>
        <input type="hidden" id="contentType" name="contentType" value="newsStory" />
        <div className="mt-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
          News Story
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Media accounts publish structured news stories. Citizens can react, and trusted roles can submit community truth ratings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="contentType" className="text-sm font-semibold text-ink">
        Content type
      </label>
      <select
        id="contentType"
        name="contentType"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-describedby={value === "opinionPerspective" ? helpId : undefined}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
      >
        <option value="statementClaim">Statement / Claim</option>
        <option value="opinionPerspective">Opinion / Perspective</option>
        <option value="announcementUpdate">Announcement / Update</option>
        <option value="event">Event</option>
        <option value="questionPoll">Question / Poll</option>
      </select>
      <p className="mt-2 text-xs text-slate-500">
        Choose the clearest label for what you are posting. Only Statement / Claim posts can receive community truth ratings.
      </p>
      {value === "opinionPerspective" ? (
        <p id={helpId} className="mt-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
          If your post includes factual claims, it may be evaluated for accuracy.
        </p>
      ) : null}
    </div>
  );
}
