import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CDR SDK and Helia are Node.js-only; never run them on the Edge runtime
  serverExternalPackages: ["@piplabs/cdr-sdk", "helia", "@helia/unixfs"],

  // Suppress Turbopack webpack-config warning
  turbopack: {},
};

export default nextConfig;
