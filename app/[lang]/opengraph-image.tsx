import { ImageResponse } from "next/og";
import type { Locale } from "@/lib/i18n/config";

/**
 * Per-locale Open Graph image foundation (Phase 2 closure).
 * Rendered at build time by the file-convention; no runtime cost.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "EL-SHEMEY — Practical AI education";

const COPY: Record<Locale, { title: string; sub: string }> = {
  en: {
    title: "EL-SHEMEY",
    sub: "From your first prompt to your first working automation.",
  },
  ar: {
    title: "إل-شمي",
    sub: "من البرومبت لأول أتمتة شغّالة.",
  },
};

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const copy = COPY[(lang === "ar" ? "ar" : "en") as Locale];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        backgroundColor: "#05070b",
        color: "#f4f7fb",
        padding: "72px",
        backgroundImage:
          "linear-gradient(rgba(148,168,204,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(148,168,204,0.10) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 28,
          fontFamily: "monospace",
          color: "#56c2ff",
          letterSpacing: 4,
        }}
      >
        PRACTICAL AI COURSES · ARABIC / ENGLISH
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700 }}>
          {copy.title}
          <span style={{ color: "#a487ff" }}>.</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            color: "#9aa5b4",
            maxWidth: 900,
          }}
        >
          {copy.sub}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          width: 220,
          height: 10,
          background: "linear-gradient(90deg,#5872f5,#56c2ff)",
        }}
      />
    </div>,
    size,
  );
}
