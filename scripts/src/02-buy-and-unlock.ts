// scripts/src/02-buy-and-unlock.ts
//
// Full buyer flow on Aeneid testnet (second wallet):
//   1. Read publish-result.json written by script 01
//   2. Deposit 2 IP → 2 WIP (wrapping)
//   3. Approve RoyaltyModule to spend WIP for license minting
//   4. Mint a Stream-tier license token for the IP Asset
//   5. Build accessAuxData = abi.encode(uint256[] [licenseTokenId])
//   6. Call CDR consumer.downloadFile — validators threshold-decrypt, client recovers AES key
//   7. Decrypt the full track bytes and write to output/decrypted-track.mp3
//
// Run: pnpm buy-unlock   (Node 22+ required — nvm use 22)

import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  encodeAbiParameters, createPublicClient, createWalletClient,
  http, parseEther, defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { StoryClient } from "@story-protocol/core-sdk";
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

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL  = process.env.AENEID_RPC_URL ?? "https://aeneid.storyrpc.io";
const API_URL  = process.env.STORY_API_URL  ?? "http://172.192.41.96:1317";
const EXPLORER = "https://aeneid.storyscan.xyz";

const BUYER_PK       = requireEnv("BUYER_PRIVATE_KEY");
const ROYALTY_MODULE = "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086" as `0x${string}`;

const aeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🎧  Backstage — Buy & Unlock\n");
  const t0 = Date.now();

  await initWasm();
  log("WASM", "crypto module initialised");

  // Load output from script 01
  const pub = JSON.parse(
    readFileSync(resolve(__dirname, "../output/publish-result.json"), "utf8"),
  );
  const { ipId, streamTermsId, fullTrackUuid, fullTrackCid } = pub;

  const buyerAccount = privateKeyToAccount(`0x${BUYER_PK.replace(/^0x/, "")}` as `0x${string}`);
  log("Wallet", `buyer = ${buyerAccount.address}`);

  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: buyerAccount, transport: http(RPC_URL), chain: aeneid });
  const storyClient  = StoryClient.newClient({ transport: http(RPC_URL), account: buyerAccount, chainId: "aeneid" });
  const cdrClient    = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: API_URL });

  // ── Step 1: Deposit IP → WIP (skip if already have enough WIP) ───────────────
  stepHdr(1, "Check / deposit WIP");

  const WIP_TOKEN = "0x1514000000000000000000000000000000000000" as `0x${string}`;
  const wipBalance = await publicClient.readContract({
    address: WIP_TOKEN,
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: [buyerAccount.address],
  }) as bigint;

  if (wipBalance < parseEther("0.1")) {
    const depositResult = await storyClient.wipClient.deposit({ amount: parseEther("0.1") });
    log("WIP Deposit", "0.1 IP → 0.1 WIP", depositResult.txHash);
  } else {
    log("WIP Balance", `already have ${(Number(wipBalance) / 1e18).toFixed(2)} WIP — skipping deposit`);
  }

  // ── Step 2: Approve RoyaltyModule ─────────────────────────────────────────
  stepHdr(2, "Approve RoyaltyModule for 0.1 WIP");

  const approveResult = await storyClient.wipClient.approve({
    spender: ROYALTY_MODULE,
    amount:  parseEther("0.1"),
  });
  log("WIP Approve", "RoyaltyModule approved", approveResult.txHash);

  // ── Step 3: Mint license token ────────────────────────────────────────────
  stepHdr(3, `Mint Stream tier license (termsId=${streamTermsId})`);

  const mintResult = await storyClient.license.mintLicenseTokens({
    licensorIpId:   ipId as `0x${string}`,
    licenseTermsId: BigInt(streamTermsId),
    amount: 1,
  });
  const licenseTokenId = mintResult.licenseTokenIds![0];
  log("License Token", `minted tokenId=${licenseTokenId}`, mintResult.txHash);

  // ── Step 4: CDR read — threshold decrypt ──────────────────────────────────
  stepHdr(4, "CDR threshold decryption via consumer.downloadFile");

  // accessAuxData = abi.encode(uint256[] tokenIds)
  // The condition contract decodes this and checks caller owns the token for the right IP + tier
  const accessAuxData = encodeAbiParameters(
    [{ type: "uint256[]" }],
    [[licenseTokenId]],
  );
  log("accessAuxData", `token IDs encoded: [${licenseTokenId}]`);

  // HeliaProvider: use a Helia node to fetch the encrypted file via DHT.
  // The file was uploaded and DHT-announced by script 01.
  console.log("  Starting Helia node…");
  const helia   = await createHelia();
  const heliaFS = unixfs(helia);
  const storage = new HeliaProvider({ helia, unixfs: heliaFS, CID: (str: string) => CID.parse(str) });

  console.log(`  Vault uuid=${fullTrackUuid}  CID=${fullTrackCid}`);
  console.log("  Waiting for validator partial decryptions (up to 120 s)…");

  const { content: decryptedBytes, txHash: readTx } = await cdrClient.consumer.downloadFile({
    uuid:            fullTrackUuid,
    accessAuxData,
    storageProvider: storage,
    timeoutMs:       120_000,
  });

  log("CDR Decrypt", `recovered ${(decryptedBytes.length / 1e6).toFixed(2)} MB`, readTx);

  // ── Step 5: Write output ──────────────────────────────────────────────────
  stepHdr(5, "Write decrypted audio");

  mkdirSync(resolve(__dirname, "../output"), { recursive: true });
  const outPath = resolve(__dirname, "../output/decrypted-track.mp3");
  writeFileSync(outPath, decryptedBytes);
  log("Output", `${outPath}  (${(decryptedBytes.length / 1e6).toFixed(2)} MB)`);

  await helia.stop();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ✅  Buyer flow complete in ${elapsed}s`);
  console.log(`${"═".repeat(64)}`);
  console.log(`\n  License Token:  ${licenseTokenId}`);
  console.log(`  CDR Read Tx:    ${EXPLORER}/tx/${readTx}`);
  console.log(`  Decrypted file: ${outPath}`);
  console.log(`\n  ▶  Play: open output/decrypted-track.mp3\n`);
}

main().catch((err) => { console.error("\n❌", err); process.exit(1); });
