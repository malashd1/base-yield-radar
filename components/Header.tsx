import Link from "next/link";

/**
 * Site header. Server component — no client interactivity needed yet.
 * When we add wallet connect (Phase 8), the ConnectButton mount goes here.
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050608]/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-500/20 text-xs font-semibold text-blue-300">
            B
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Base Yield Radar
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/yields">Yields</NavLink>
          <a
            href="https://t.me/"
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-md px-3 py-1.5 text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            TG bot ↗
          </a>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-white/70 transition hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}
