import Script from "next/script";
import { ADSENSE_CLIENT } from "@/lib/ads";

/**
 * Google AdSense loader. Imported once in app/layout.tsx (inside <head>).
 * Loads the official adsbygoogle.js script and declares the AdSense
 * account via the google-adsense-account meta tag.
 */
export default function AdSense() {
  return (
    <>
      <meta name="google-adsense-account" content={ADSENSE_CLIENT} />
      <Script
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        async
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </>
  );
}
