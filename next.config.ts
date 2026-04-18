import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    after: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.gamma.app" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
    ],
  },
};

export default nextConfig;
