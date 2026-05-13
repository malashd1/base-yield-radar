import { ImageResponse } from "next/og";

/**
 * Site-wide OG image. Static-ish — same for every share.
 * Per-page variants can be added by reading ?title= and ?subtitle= params.
 *
 * GET /api/og?title=...&subtitle=...
 */

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title") ?? "Base Yield Radar";
  const subtitle =
    url.searchParams.get("subtitle") ??
    "Best yields on Base. Without the rugs.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #050608 0%, #0a1430 100%)",
          color: "#ededed",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "rgba(59, 130, 246, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#93c5fd",
            }}
          >
            B
          </div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>
            Base Yield Radar
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: "#fff",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              color: "rgba(255,255,255,0.7)",
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 18,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <span>defillama · 0x · base mainnet</span>
          <span>non-custodial</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
