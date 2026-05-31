import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CDR SDK and Helia are Node.js-only; never run them on the Edge runtime
  serverExternalPackages: ["@piplabs/cdr-sdk", "helia", "@helia/unixfs"],

  webpack(config) {
    // Polyfill Node.js builtins expected by viem/wagmi in browser bundles
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
