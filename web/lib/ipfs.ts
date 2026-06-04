const LOCAL_GW = process.env.IPFS_GATEWAY_URL ?? "http://127.0.0.1:8080/ipfs";

/**
 * Returns a URL suitable for use as an <img> / next/image src in the browser.
 * Always uses the same-origin /api/ipfs proxy so SSR-rendered markup matches
 * what the browser will see (avoids hydration mismatch on the image src).
 */
export function ipfsUrl(cid: string): string {
  const clean = cid.replace(/^ipfs:\/\//, "");
  return `/api/ipfs/${clean}`;
}

/**
 * Returns a URL for server-side fetch() calls (API routes, RSC).
 * Uses the local gateway directly — /api/ipfs relative URLs don't resolve
 * when called from within Next.js server code.
 */
export function ipfsServerUrl(cid: string): string {
  const clean = cid.replace(/^ipfs:\/\//, "");
  return `${LOCAL_GW}/${clean}`;
}

export async function fetchMetadata(metadataURI: string): Promise<Record<string, unknown>> {
  let url: string;
  if (metadataURI.startsWith("ipfs://")) {
    url = typeof window === "undefined" ? ipfsServerUrl(metadataURI) : ipfsUrl(metadataURI);
  } else {
    url = metadataURI;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
  return res.json();
}
