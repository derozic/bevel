import Script from "next/script";

function magentaApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MAGENTA_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    return "https://api.magenta.lvh.me";
  }
  return "https://api.magenta.ac";
}

/** Magenta suite for bevel.is — JS + server ingest + pixel fallback. */
export function MagentaAnalytics() {
  const apiBase = magentaApiBase();
  const debug = process.env.NODE_ENV === "development";

  return (
    <>
      <Script id="magenta-config" strategy="afterInteractive">
        {`window._magenta={siteId:'bevel',apiBase:'${apiBase}',debug:${debug ? "true" : "false"}};`}
      </Script>
      <Script src={`${apiBase}/api/analytics/script/`} strategy="afterInteractive" />
    </>
  );
}
