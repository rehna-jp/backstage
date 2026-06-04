// Proxy for local IPFS gateway (http://127.0.0.1:8080) so the browser
// can fetch encrypted content without hitting the private codespace port.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const IPFS_GW = process.env.IPFS_GATEWAY_URL ?? "http://127.0.0.1:8080/ipfs";

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${IPFS_GW}/${path.join("/")}`;

  const upstream = await fetch(target, { method: "GET" });
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const GET = handle;
