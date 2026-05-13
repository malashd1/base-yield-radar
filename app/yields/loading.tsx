export default function Loading() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-8 w-64 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-3 w-80 animate-pulse rounded bg-white/5" />
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-white/5 px-4 py-3 last:border-0"
            >
              <div className="h-3 w-6 animate-pulse rounded bg-white/5" />
              <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
              <div className="ml-auto h-3 w-16 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-12 animate-pulse rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
