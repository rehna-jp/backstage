// Quick diagnostic: allocate a vault with the known-working LicenseReadCondition
// and attempt to decrypt. This tests whether CDR validators are responding at all.
import "dotenv/config";
import {
  encodeAbiParameters, createPublicClient, createWalletClient,
  http, defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CDRClient, initWasm, HeliaProvider } from "@piplabs/cdr-sdk";
import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";
import { CID } from "multiformats/cid";

const RPC_URL = process.env.AENEID_RPC_URL ?? "https://aeneid.storyrpc.io";
const API_URL = process.env.STORY_API_URL   ?? "http://172.192.41.96:1317";
const BUYER_PK = process.env.BUYER_PRIVATE_KEY!;

const LICENSE_READ_COND  = "0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3" as `0x${string}`;
const OWNER_WRITE_COND   = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B" as `0x${string}`;
const LICENSE_TOKEN      = "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`;

const aeneid = defineChain({
  id: 1315, name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

async function main() {
  await initWasm();
  const account = privateKeyToAccount(`0x${BUYER_PK.replace(/^0x/,"")}` as `0x${string}`);
  const publicClient = createPublicClient({ chain: aeneid, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: aeneid, transport: http(RPC_URL) });
  const cdrClient = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: API_URL });

  const helia = await createHelia();
  const heliaFS = unixfs(helia);
  const storage = new HeliaProvider({ helia, unixfs: heliaFS, CID: (s: string) => CID.parse(s) });

  // Use existing ipId from publish-result.json
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname2 = dirname(fileURLToPath(import.meta.url));
  const pub = JSON.parse(readFileSync(resolve(__dirname2, "../output/publish-result.json"), "utf8"));
  const { ipId } = pub;

  // Allocate a small vault with LicenseReadCondition (NOT our custom condition)
  const readCondData = encodeAbiParameters([{type:"address"},{type:"address"}], [LICENSE_TOKEN, ipId]);
  const writeCondData = encodeAbiParameters([{type:"address"}], [account.address]);

  console.log("Allocating diagnostic vault with LicenseReadCondition...");
  const { uuid } = await cdrClient.uploader.uploadFile({
    content: new TextEncoder().encode("diagnostic-payload"),
    storageProvider: storage,
    updatable: false,
    writeConditionAddr: OWNER_WRITE_COND,
    writeConditionData: writeCondData,
    readConditionAddr: LICENSE_READ_COND,
    readConditionData: readCondData,
    accessAuxData: "0x",
  });
  console.log("Vault uuid:", uuid);

  // Present the most recently minted license token (72729)
  const accessAuxData = encodeAbiParameters([{type:"uint256[]"}], [[72729n]]);
  console.log("Attempting CDR read with LicenseReadCondition (timeout 120s)...");

  try {
    const { content } = await cdrClient.consumer.downloadFile({
      uuid, accessAuxData, storageProvider: storage, timeoutMs: 120_000, skipCidVerification: true,
    });
    console.log("✅ SUCCESS — content:", new TextDecoder().decode(content));
  } catch (err) {
    console.log("❌ FAILED:", err instanceof Error ? err.message : err);
  }

  await helia.stop();
}

main().catch(console.error);
