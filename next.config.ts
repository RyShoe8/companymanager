import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {},
  images: {
    remotePatterns: [],
    // Allow images from uploads directory
    unoptimized: false,
  },
};

export default nextConfig;
