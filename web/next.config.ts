import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@piplabs/cdr-sdk", "helia", "@helia/unixfs"],
  turbopack: {},
  images: {
    // Allow next/image to serve from our same-origin IPFS proxy and dweb.link
    remotePatterns: [
      { protocol: "https", hostname: "dweb.link" },
      { protocol: "http",  hostname: "127.0.0.1", port: "8080" },
    ],
    // /api/ipfs/* paths are served from the same origin — treat as unoptimized
    unoptimized: true,
  },
};

export default nextConfig;
