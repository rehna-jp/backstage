// Proxy for the CDR Story-API (http) so the browser (on HTTPS) can reach it
// without being blocked by mixed-content policy.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const CDR_API = process.env.NEXT_PUBLIC_CDR_API_URL ?? "http://172.192.41.96:1317";

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(req.url);
  const target = `${CDR_API}/${path.join("/")}${url.search}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const upstream = await fetch(target, {
    method:  req.method,
    headers,
    body:    req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
  });

  const body = await upstream.text();
  return new NextResponse(body, {
    status:  upstream.status,
    headers: {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const GET     = handle;
export const POST    = handle;
export const OPTIONS = () => new NextResponse(null, {
  headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" },
});
