import Link from "next/link";
import ConnectButton from "@/components/ConnectButton";

/**
 * Site header. Mostly server, but mounts the client ConnectButton.
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050608]/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
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
          <div className="ml-2">
            <ConnectButton />
          </div>
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
