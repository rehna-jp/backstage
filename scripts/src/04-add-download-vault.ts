// scripts/src/04-add-download-vault.ts
//
// Allocates a CDR vault gated by the Download tier's License Terms ID and
// re-registers the work in BackstageRegistry with three vaults in tier order:
//
//   gatedVaultUuids[0] = full track   (stream-gated,     streamTermsId)
//   gatedVaultUuids[1] = full track   (download-gated,   downloadTermsId)  ← new
//   gatedVaultUuids[2] = stems        (commercial-gated, commercialTermsId)
//
// This lets TierModal use gatedVaultUuids[tierIndex] directly.
//
// Prerequisite: 01-publish-work.ts must have run and written output/publish-result.json.
// Run: pnpm add-download-vault   (Node 22+ required)

import { config } from "dotenv";
import { resolve as _resolve, dirname as _dirname } from "node:path";
import { fileURLToPath as _ftu } from "node:url";
// Load .env from project root (parent of scripts/)
config({ path: _resolve(_dirname(_ftu(import.meta.url)), "../../.env") });
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  encodeAbiParameters, createPublicClient, createWalletClient,
  http, defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CDRClient, initWasm, GatewayProvider } from "@piplabs/cdr-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required — check your .env file`);
  return v;
}

function log(tag: string, msg: string, tx?: string) {
  const ts = new Date().toISOString().slice(11, 23);
  const link = tx ? `\n    ${EXPLORER}/tx/${tx}` : "";
  console.log(`[${ts}] ✓ ${tag}: ${msg}${link}`);
}

function stepHdr(n: number, msg: string) {
  console.log(`\n${"─".repeat(64)}`);
  console.log(`  Step ${n}: ${msg}`);
  console.log("─".repeat(64));
}

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL      = process.env.AENEID_RPC_URL   ?? "https://aeneid.storyrpc.io";
const API_URL      = process.env.STORY_API_URL    ?? "http://172.192.41.96:1317";
const IPFS_API_URL = process.env.IPFS_API_URL     ?? "http://127.0.0.1:5001";
const IPFS_GW_URL  = process.env.IPFS_GATEWAY_URL ?? "http://127.0.0.1:8080/ipfs";
const EXPLORER     = "https://aeneid.storyscan.xyz";

const PK               = requireEnv("WALLET_PRIVATE_KEY");
const TIERED_READ_COND = (process.env.TIERED_LICENSE_READ_CONDITION ?? process.env.NEXT_PUBLIC_TIERED_LICENSE_READ_CONDITION ?? requireEnv("TIERED_LICENSE_READ_CONDITION")) as `0x${string}`;
const REGISTRY_ADDR    = (process.env.BACKSTAGE_REGISTRY            ?? process.env.NEXT_PUBLIC_BACKSTAGE_REGISTRY            ?? requireEnv("BACKSTAGE_REGISTRY"))            as `0x${string}`;

const LICENSE_TOKEN    = "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`;
const OWNER_WRITE_COND = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B" as `0x${string}`;

const aeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "StoryScan", url: EXPLORER } },
});

const REGISTRY_ABI = [
  {
    name: "registerWork",
    type: "function",
    inputs: [
      { name: "ipId",            type: "address"  },
      { name: "previewCID",      type: "string"   },
      { name: "gatedVaultUuids", type: "uint32[]" },
      { name: "licenseTermsIds", type: "uint256[]"},
      { name: "metadataURI",     type: "string"   },
    ],
    outputs: [{ name: "workId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n⬇️   Backstage — Add Download Vault\n");
  const t0 = Date.now();

  // ── Load publish-result.json ─────────────────────────────────────────────
  const outPath = resolve(__dirname, "../output/publish-result.json");
  const pub = JSON.parse(readFileSync(outPath, "utf8"));

  const {
    ipId,
    streamTermsId,
    downloadTermsId,
    commercialTermsId,
    fullTrackUuid,
    stemsUuid,
    previewCid,
  } = pub;

  console.log(`  IP Asset:        ${ipId}`);
  console.log(`  Stream terms:    ${streamTermsId}`);
  console.log(`  Download terms:  ${downloadTermsId}`);
  console.log(`  Commercial terms:${commercialTermsId}`);
  console.log(`  Existing vaults: fullTrack=${fullTrackUuid}  stems=${stemsUuid}`);

  await initWasm();
  log("WASM", "crypto module initialised");

  const account      = privateKeyToAccount(`0x${PK.replace(/^0x/, "")}` as `0x${string}`);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL), chain: aeneid });
  const cdrClient    = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: API_URL });

  log("Wallet", `creator = ${account.address}`);

  const storage = new GatewayProvider({ apiUrl: IPFS_API_URL, gatewayUrl: IPFS_GW_URL });

  const globalPubKey = await cdrClient.observer.getGlobalPubKey();
  log("CDR", "DKG global public key fetched");

  // ── Step 1: Allocate download-gated vault ─────────────────────────────────
  stepHdr(1, "Allocate CDR vault gated by downloadTermsId");

  const trackBytes = new Uint8Array(readFileSync(resolve(__dirname, "../assets/track.mp3")));
  console.log(`  Encrypting ${(trackBytes.length / 1e6).toFixed(2)} MB full track for download vault…`);

  const downloadReadCondData = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    [LICENSE_TOKEN, ipId as `0x${string}`, BigInt(downloadTermsId)],
  );
  const writeCondData = encodeAbiParameters([{ type: "address" }], [account.address]);

  const downloadResult = await cdrClient.uploader.uploadFile({
    content:            trackBytes,
    storageProvider:    storage,
    globalPubKey,
    updatable:          false,
    writeConditionAddr: OWNER_WRITE_COND,
    writeConditionData: writeCondData,
    readConditionAddr:  TIERED_READ_COND,
    readConditionData:  downloadReadCondData,
    accessAuxData:      "0x",
  });
  log(
    "CDR Download",
    `uuid=${downloadResult.uuid}  cid=${downloadResult.cid}`,
    downloadResult.txHashes.write,
  );

  // ── Step 2: Re-register work with 3 vaults in tier order ──────────────────
  stepHdr(2, "Re-register work — 3 vaults in tierIndex order");

  // Vault order matches licenseTermsIds order so TierModal can use gatedVaultUuids[tierIndex]:
  //   vault[0] = full track  (streamTermsId)
  //   vault[1] = full track  (downloadTermsId)  ← new
  //   vault[2] = stems       (commercialTermsId)
  const regTxHash = await walletClient.writeContract({
    address:      REGISTRY_ADDR,
    abi:          REGISTRY_ABI,
    functionName: "registerWork",
    args: [
      ipId as `0x${string}`,
      previewCid as string,
      [fullTrackUuid, downloadResult.uuid, stemsUuid] as [number, number, number],
      [BigInt(streamTermsId), BigInt(downloadTermsId), BigInt(commercialTermsId)],
      pub.metadataURI ?? `data:application/json;base64,${Buffer.from(JSON.stringify({ title: pub.title ?? "Moonrise — Unreleased Demo" })).toString("base64")}`,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: regTxHash });

  // Parse WorkRegistered event: topics[1] = workId (indexed)
  const registryAddrLower = REGISTRY_ADDR.toLowerCase();
  const regLog = receipt.logs.find((l) => l.address.toLowerCase() === registryAddrLower);
  const newWorkId = regLog?.topics[1] ? Number(BigInt(regLog.topics[1])) : "?";
  log("Registry", `re-registered as workId=${newWorkId}`, regTxHash);

  // ── Step 3: Update publish-result.json ────────────────────────────────────
  stepHdr(3, "Update output/publish-result.json");

  const updated = {
    ...pub,
    workId:            newWorkId,
    downloadVaultUuid: downloadResult.uuid,
    downloadVaultCid:  downloadResult.cid,
    // Canonical vault ordering matching tier indices:
    vaultOrder: ["fullTrack (stream-gated)", "fullTrack (download-gated)", "stems (commercial-gated)"],
  };
  writeFileSync(outPath, JSON.stringify(updated, null, 2));
  log("Output", outPath);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ✅  Done in ${elapsed}s`);
  console.log(`${"═".repeat(64)}`);
  console.log(`\n  New workId:       ${newWorkId}`);
  console.log(`  Download vault:   uuid=${downloadResult.uuid}`);
  console.log(`  Vault order:      [fullTrack(stream), fullTrack(download), stems(commercial)]`);
  console.log(`\n  Browse /works/${newWorkId} — all three tiers now have CDR vaults.\n`);
}

main().catch((err) => { console.error("\n❌", err); process.exit(1); });
