import Script from "next/script";

/**
 * Google Analytics 4 (gtag). Imported once in app/layout.tsx (inside <head>).
 * Property "Kage TV", Measurement ID G-4LR2DM9QM8.
 */
export default function Analytics() {
  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-4LR2DM9QM8"
        async
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-4LR2DM9QM8');`}
      </Script>
    </>
  );
}
