// rawIPFSProvider.ts
//
// A CDR-compatible IPFS storage provider that uploads files as a single raw
// block (CIDv1, sha2-256) so the CDR SDK's CID integrity check passes.
//
// The default GatewayProvider uses /api/v0/add without params, which chunks
// large files into a dag-pb DAG (Qm... CIDv0). The CDR SDK verifies
//   sha256(raw_bytes) == CID
// which only holds for raw-codec CIDv1 blocks, not dag-pb roots.
//
// Fix: upload with cid-version=1 and a chunk size larger than the file so
// the whole file becomes a single raw leaf whose CID = sha256(content).

export class RawIPFSProvider {
  private apiUrl: string;
  private gatewayUrl: string;

  constructor(params: { apiUrl: string; gatewayUrl: string }) {
    this.apiUrl = params.apiUrl.replace(/\/+$/, "");
    this.gatewayUrl = params.gatewayUrl.replace(/\/+$/, "");
  }

  async upload(data: Uint8Array, options?: { pin?: boolean }): Promise<string> {
    const { pin = true } = options ?? {};

    // Use the Block API to store as a single raw block.
    // CID = CIDv1(raw, sha256(content)) = bafkrei...
    // This is what the CDR SDK's integrity check expects.
    const formData = new FormData();
    const buf = new ArrayBuffer(data.byteLength);
    new Uint8Array(buf).set(data);
    formData.append("data", new Blob([buf]));

    const url = `${this.apiUrl}/api/v0/block/put?format=raw&mhtype=sha2-256&allow-big-block=true&pin=${pin}`;
    const response = await fetch(url, { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(`IPFS block/put failed: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    return result.Key as string;  // "Key" not "Hash" for block/put
  }

  async download(cid: string): Promise<Uint8Array> {
    const response = await fetch(`${this.gatewayUrl}/${cid}`);
    if (!response.ok) {
      throw new Error(`IPFS gateway download failed: ${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}
