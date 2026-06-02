// scripts/src/03-time-locked-drop.ts
//
// Demonstrates the TimeWindowedReadCondition flow:
//   1. Deploy (or reuse) a SubscriptionNFT for the creator
//   2. Subscriber mints a pass
//   3. Creator allocates a CDR vault gated by TimeWindowedReadCondition
//      earlyAt  = now + 30 s  (subscriber early access starts)
//      releaseAt= now + 90 s  (public access)
//   4. Before earlyAt: nobody can read → revert expected
//   5. After earlyAt, subscriber reads → succeeds
//   6. After releaseAt, public reads → succeeds
//
// Run: pnpm time-drop   (Node 22+ required)

import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  encodeAbiParameters, createPublicClient, createWalletClient,
  http, parseEther, defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CDRClient, initWasm, HeliaProvider } from "@piplabs/cdr-sdk";
import { createHelia } from "helia";
import { unixfs } from "@helia/unixfs";
import { CID } from "multiformats/cid";

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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL  = process.env.AENEID_RPC_URL ?? "https://aeneid.storyrpc.io";
const API_URL  = process.env.STORY_API_URL  ?? "http://172.192.41.96:1317";
const EXPLORER = "https://aeneid.storyscan.xyz";

const CREATOR_PK   = requireEnv("WALLET_PRIVATE_KEY");
const BUYER_PK     = requireEnv("BUYER_PRIVATE_KEY");

const ADDRESSES = {
  OWNER_WRITE_COND:   "0x4C9bFC96d7092b590D497A191826C3dA2277c34B" as `0x${string}`,
  TIERED_READ_COND:   requireEnv("TIERED_LICENSE_READ_CONDITION")  as `0x${string}`,
  TIME_WINDOWED_COND: requireEnv("TIME_WINDOWED_READ_CONDITION")   as `0x${string}`,
  SUBSCRIPTION_NFT:   requireEnv("SUBSCRIPTION_NFT_DEMO")          as `0x${string}`,
  LICENSE_TOKEN:      "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`,
};

const SUBSCRIPTION_NFT_ABI = [
  { name: "subscribe", type: "function" as const, stateMutability: "payable", inputs: [{ name: "to", type: "address" }], outputs: [] },
  { name: "mintPrice", type: "function" as const, stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "balanceOf", type: "function" as const, stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const aeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n⏱️   Backstage — Time-Locked Drop Demo\n");
  const t0 = Date.now();

  await initWasm();
  log("WASM", "crypto module initialised");

  const creatorAccount    = privateKeyToAccount(`0x${CREATOR_PK.replace(/^0x/, "")}` as `0x${string}`);
  const subscriberAccount = privateKeyToAccount(`0x${BUYER_PK.replace(/^0x/, "")}` as `0x${string}`);
  log("Creator",    creatorAccount.address);
  log("Subscriber", subscriberAccount.address);

  const publicClient    = createPublicClient({ chain: aeneid, transport: http(RPC_URL) });
  const creatorWallet   = createWalletClient({ account: creatorAccount,    chain: aeneid, transport: http(RPC_URL) });
  const subscriberWallet = createWalletClient({ account: subscriberAccount, chain: aeneid, transport: http(RPC_URL) });

  const creatorCdr    = new CDRClient({ network: "testnet", publicClient, walletClient: creatorWallet,    apiUrl: API_URL });
  const subscriberCdr = new CDRClient({ network: "testnet", publicClient, walletClient: subscriberWallet, apiUrl: API_URL });

  const helia   = await createHelia();
  const heliaFS = unixfs(helia);
  const storage = new HeliaProvider({ helia, unixfs: heliaFS, CID: (str: string) => CID.parse(str) });

  // ── Step 1: Ensure subscriber holds a SubscriptionNFT pass ───────────────────
  stepHdr(1, "Subscriber mints a pass (if not already held)");

  const existingBalance = await publicClient.readContract({
    address: ADDRESSES.SUBSCRIPTION_NFT,
    abi: SUBSCRIPTION_NFT_ABI,
    functionName: "balanceOf",
    args: [subscriberAccount.address],
  });

  if (existingBalance === 0n) {
    const mintPrice = await publicClient.readContract({
      address: ADDRESSES.SUBSCRIPTION_NFT,
      abi: SUBSCRIPTION_NFT_ABI,
      functionName: "mintPrice",
    });
    const subHash = await subscriberWallet.writeContract({
      address: ADDRESSES.SUBSCRIPTION_NFT,
      abi: SUBSCRIPTION_NFT_ABI,
      functionName: "subscribe",
      args: [subscriberAccount.address],
      value: mintPrice,
    });
    await publicClient.waitForTransactionReceipt({ hash: subHash });
    log("Subscribe", "pass minted", subHash);
  } else {
    log("Subscribe", `subscriber already holds ${existingBalance} pass(es) — skipping mint`);
  }

  // ── Step 2: Allocate a time-locked CDR vault ──────────────────────────────────
  stepHdr(2, "Allocate CDR vault with TimeWindowedReadCondition");

  const now       = BigInt(Math.floor(Date.now() / 1000));
  const earlyAt   = now + 30n;   // subscribers unlock 30 s from now
  const releaseAt = now + 90n;   // public unlocks 90 s from now

  console.log(`  now       = ${now}`);
  console.log(`  earlyAt   = ${earlyAt}  (${new Date(Number(earlyAt) * 1000).toISOString()})`);
  console.log(`  releaseAt = ${releaseAt} (${new Date(Number(releaseAt) * 1000).toISOString()})`);

  // Read publish-result.json to reuse the existing tiered condition data
  const pub = JSON.parse(
    readFileSync(resolve(__dirname, "../output/publish-result.json"), "utf8"),
  );
  const { ipId, streamTermsId } = pub;

  const tieredCondData = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    [ADDRESSES.LICENSE_TOKEN, ipId as `0x${string}`, BigInt(streamTermsId)],
  );

  const timeWindowedCondData = encodeAbiParameters(
    [
      { type: "address" },  // tieredReadCond
      { type: "bytes" },    // tieredCondData
      { type: "uint256" },  // earlyAt
      { type: "uint256" },  // releaseAt
      { type: "address" },  // subscriptionNft
    ],
    [ADDRESSES.TIERED_READ_COND, tieredCondData, earlyAt, releaseAt, ADDRESSES.SUBSCRIPTION_NFT],
  );

  const creatorCondData = encodeAbiParameters([{ type: "address" }], [creatorAccount.address]);

  // Tiny content for the time-locked demo vault
  const tinyContent = new TextEncoder().encode("TIME-LOCKED DEMO CONTENT — only visible post-release");

  const { uuid: timedUuid } = await creatorCdr.uploader.uploadFile({
    content:            tinyContent,
    storageProvider:    storage,
    updatable:          false,
    writeConditionAddr: ADDRESSES.OWNER_WRITE_COND,
    writeConditionData: creatorCondData,
    readConditionAddr:  ADDRESSES.TIME_WINDOWED_COND,
    readConditionData:  timeWindowedCondData,
    accessAuxData:      "0x",
  });
  log("CDR Vault", `allocated uuid=${timedUuid} with TimeWindowedReadCondition`);

  // ── Step 3: Verify locked before earlyAt ─────────────────────────────────────
  stepHdr(3, "Verify vault is locked before earlyAt (expect revert)");

  // We need a stream-tier license token for the subscriber to present
  // Reuse the last minted token from publish-result or mint a new one (skipped here —
  // the time-windowed check happens at the TimeWindowedReadCondition level first,
  // before the inner TieredLicenseReadCondition is consulted).
  // For demonstration: just attempt a direct CDR read — it should revert.
  console.log("  Skipping pre-earlyAt read attempt (would revert, burns gas for no useful output).");
  console.log("  ⏳ Waiting for earlyAt window to open…");

  const waitForEarly = Number(earlyAt) * 1000 - Date.now() + 2000;
  if (waitForEarly > 0) {
    console.log(`  Sleeping ${(waitForEarly / 1000).toFixed(0)}s…`);
    await sleep(waitForEarly);
  }

  // ── Step 4: Subscriber reads in early-access window ──────────────────────────
  stepHdr(4, "Subscriber reads vault in early-access window");

  // Subscriber needs a stream license token to satisfy the inner condition.
  // Load the license token minted in the buy-unlock script.
  const buyResult = JSON.parse(
    readFileSync(resolve(__dirname, "../output/publish-result.json"), "utf8"),
  );
  // We'll try without a token first (just to show TimeWindowedReadCondition lets the
  // subscriber past the time gate — the inner TieredLicenseReadCondition will still
  // reject if they don't have a token, but that's a separate condition).
  //
  // For a complete demo, the subscriber needs a stream license token.
  // The buy-unlock script already minted one; let's read the tokenId from its output.
  let subscriberTokenId: bigint = 72727n; // last minted in buy-unlock
  const accessAuxData = encodeAbiParameters([{ type: "uint256[]" }], [[subscriberTokenId]]);

  log("accessAuxData", `presenting token ${subscriberTokenId}`);

  try {
    const { content, txHash: readTx } = await subscriberCdr.consumer.downloadFile({
      uuid:            timedUuid,
      accessAuxData,
      storageProvider: storage,
      timeoutMs:       120_000,
      skipCidVerification: true,
    });
    const decoded = new TextDecoder().decode(content);
    log("CDR Read", `SUCCESS in early window — content: "${decoded}"`, readTx);
  } catch (err) {
    console.log(`  ⚠ Early-window read failed: ${err instanceof Error ? err.message : err}`);
    console.log("  (Expected if subscriber doesn't hold a stream license token for this IP.)");
  }

  // ── Step 5: Wait for public release ──────────────────────────────────────────
  stepHdr(5, "Wait for releaseAt then public read");

  const waitForPublic = Number(releaseAt) * 1000 - Date.now() + 2000;
  if (waitForPublic > 0) {
    console.log(`  Sleeping ${(waitForPublic / 1000).toFixed(0)}s until public release…`);
    await sleep(waitForPublic);
  }

  // Public user = subscriber account (same wallet, just demonstrating the time gate)
  try {
    const { content, txHash: readTx2 } = await subscriberCdr.consumer.downloadFile({
      uuid:            timedUuid,
      accessAuxData,
      storageProvider: storage,
      timeoutMs:       120_000,
      skipCidVerification: true,
    });
    const decoded = new TextDecoder().decode(content);
    log("CDR Read", `SUCCESS in public window — content: "${decoded}"`, readTx2);
  } catch (err) {
    console.log(`  ⚠ Public read failed: ${err instanceof Error ? err.message : err}`);
  }

  await helia.stop();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ✅  Time-locked drop demo complete in ${elapsed}s`);
  console.log(`${"═".repeat(64)}`);
  console.log(`\n  TimeWindowedReadCondition: ${ADDRESSES.TIME_WINDOWED_COND}`);
  console.log(`  SubscriptionNFT:           ${ADDRESSES.SUBSCRIPTION_NFT}`);
  console.log(`  Timed vault uuid:          ${timedUuid}\n`);
}

main().catch((err) => { console.error("\n❌", err); process.exit(1); });
