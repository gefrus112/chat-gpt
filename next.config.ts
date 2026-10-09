import type { NextConfig } from "next";

/**
 * BUILD_STATIC=1 → fully static export for GitHub Pages (no API routes, demo mode).
 * PAGES_BASE_PATH defaults to the repo page sub-path /chat-gpt.
 */
const isStatic = process.env.BUILD_STATIC === "1";

const nextConfig: NextConfig = isStatic
  ? {
      output: "export",
      images: { unoptimized: true },
      basePath: process.env.PAGES_BASE_PATH || "/chat-gpt",
      trailingSlash: true,
      env: { NEXT_PUBLIC_BASE_PATH: process.env.PAGES_BASE_PATH || "/chat-gpt" },
      typescript: {
        ignoreBuildErrors: true,
      },
      reactStrictMode: false,
    }
  : {
      output: "standalone",
      env: { NEXT_PUBLIC_BASE_PATH: "" },
      typescript: {
        ignoreBuildErrors: true,
      },
      reactStrictMode: false,
    };

export default nextConfig;
