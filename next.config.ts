import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow larger server action payloads (mobile photos can be 5-10 MB as base64)
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
