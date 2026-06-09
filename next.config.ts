import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker builds
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  // Suppress source maps in production
  productionBrowserSourceMaps: false,

  // Configure server behavior
  serverExternalPackages: ["@aws-sdk/client-cloudwatch"],
};

export default nextConfig;
