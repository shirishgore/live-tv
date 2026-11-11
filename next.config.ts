import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Kage TV is fully personalized (country + device prefs from cookies),
  // so Cache Components / static prerendering is disabled.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
