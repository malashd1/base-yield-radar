export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-8 text-xs text-white/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <span>
          Base Yield Radar · data via{" "}
          <a
            href="https://defillama.com/yields?chain=Base"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-white/70"
          >
            DeFiLlama
          </a>{" "}
          · routing via{" "}
          <a
            href="https://0x.org"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-white/70"
          >
            0x
          </a>
        </span>
        <span>
          Not financial advice. DeFi carries risk including total loss.
        </span>
      </div>
    </footer>
  );
}
