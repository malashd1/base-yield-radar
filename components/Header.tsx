import Link from "next/link";
import ConnectButton from "@/components/ConnectButton";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#07090f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap"
        >
          <LogoMark />
          <span className="hidden text-[15px] font-semibold tracking-tight text-white sm:inline">
            Base Yield Radar
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/yields">Yields</NavLink>
          <a
            href="https://t.me/Basedefi_bot"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden rounded-full px-3 py-1.5 text-white/60 transition hover:bg-white/[0.05] hover:text-white sm:inline-flex sm:items-center sm:gap-1"
          >
            Telegram <span className="text-[10px] opacity-60">↗</span>
          </a>
          <div className="ml-1 sm:ml-2">
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
      className="rounded-full px-3 py-1.5 text-white/70 transition hover:bg-white/[0.05] hover:text-white"
    >
      {children}
    </Link>
  );
}

function LogoMark() {
  return (
    <span
      aria-hidden
      className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg"
      style={{
        background:
          "linear-gradient(135deg, #5bd8ff 0%, #38bdf8 50%, #8b5cf6 100%)",
      }}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 text-[#061018]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 13L8 3L14 13" />
        <path d="M5 11H11" />
      </svg>
    </span>
  );
}
