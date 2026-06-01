const GATEWAY = "https://dweb.link/ipfs";

export function ipfsUrl(cid: string): string {
  const clean = cid.replace(/^ipfs:\/\//, "");
  return `${GATEWAY}/${clean}`;
}

export async function fetchMetadata(metadataURI: string): Promise<Record<string, unknown>> {
  const url = metadataURI.startsWith("ipfs://") ? ipfsUrl(metadataURI) : metadataURI;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
  return res.json();
}
