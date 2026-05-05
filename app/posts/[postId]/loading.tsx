export default function PostDetailLoading() {
  return (
    <div className="space-y-6 py-8">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Loading</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">Loading post</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          We&apos;re opening this post now. Truth details and other secondary sections may continue loading after the post appears.
        </p>
      </section>
    </div>
  );
}
