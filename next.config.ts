import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Real book covers looked up via Open Library (src/lib/openLibrary.ts)
      { protocol: "https", hostname: "covers.openlibrary.org" },
      // Used by the hardcoded demo/fallback books shown before any real data exists
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      // Google Books API cover fallback thumbnails
      { protocol: "https", hostname: "books.google.com" },
      // Open Library covers redirect to Internet Archive subdomains (e.g. ia801705.us.archive.org)
      { protocol: "https", hostname: "**.archive.org" },
    ],
  },
};

export default nextConfig;
