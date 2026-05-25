import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["billing-engine"],
  reactCompiler: true,
  turbopack: {},
  images: {
    remotePatterns: [],
    // Allow images from uploads directory
    unoptimized: false,
  },
};

export default nextConfig;
