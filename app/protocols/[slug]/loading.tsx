export default function Loading() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
        <div className="mt-3 h-9 w-64 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-white/5" />
        <div className="mt-8 h-44 animate-pulse rounded-xl border border-white/10 bg-white/[0.02]" />
        <div className="mt-8 h-64 animate-pulse rounded-xl border border-white/10 bg-white/[0.02]" />
      </div>
    </main>
  );
}
