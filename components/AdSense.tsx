import { ADSENSE_CLIENT } from "@/lib/ads";

/**
 * Google AdSense loader. Imported once in app/layout.tsx (inside <head>).
 *
 * This MUST be a plain <script> tag, not next/script: next/script with
 * afterInteractive only renders a <link rel="preload"> plus the URL inside
 * a JSON blob in the server HTML, and Google's verification crawler looks
 * for the real AdSense snippet in the page source — it could not see the
 * code, so verification failed ("Couldn't verify your site"). A plain
 * async tag is exactly what AdSense asks for, and it still loads the
 * script asynchronously for real visitors.
 */
export default function AdSense() {
  return (
    <>
      <meta name="google-adsense-account" content={ADSENSE_CLIENT} />
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        crossOrigin="anonymous"
      />
    </>
  );
}
