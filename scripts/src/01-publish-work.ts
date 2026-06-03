// scripts/src/01-publish-work.ts
//
// Full creator flow on Aeneid testnet:
//   1. Create an SPG NFT collection for the creator (or reuse from SPG_NFT_CONTRACT env)
//   2. Mint + register IP Asset + attach 3 PIL tiers (stream / download / commercial)
//   3. Upload preview clip to plain IPFS via Helia (always free, no CDR)
//   4. Upload full track to CDR vault gated by TieredLicenseReadCondition (stream tier)
//   5. Upload stems to CDR vault gated by TieredLicenseReadCondition (commercial tier)
//   6. Register work in BackstageRegistry
//   7. Write output JSON for 02-buy-and-unlock.ts
//
// Run: pnpm publish-work   (Node 22+ required — nvm use 22)

import { config } from "dotenv";
import { resolve as _r, dirname as _d } from "node:path";
import { fileURLToPath as _f } from "node:url";
config({ path: _r(_d(_f(import.meta.url)), "../../.env") });
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  encodeAbiParameters, createPublicClient, createWalletClient,
  http, parseEther, keccak256, toBytes, defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { StoryClient, PILFlavor, NativeRoyaltyPolicy } from "@story-protocol/core-sdk";
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

// Aeneid — addresses sourced from storyprotocol/sdk generated.ts
const WIP_TOKEN        = "0x1514000000000000000000000000000000000000" as `0x${string}`;
const LICENSE_TOKEN    = "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`;
const OWNER_WRITE_COND = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B" as `0x${string}`;

const aeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "StoryScan", url: EXPLORER } },
});

// BackstageRegistry ABI subset
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
  console.log("\n🎵  Backstage — Publish Work\n");
  const t0 = Date.now();

  await initWasm();
  log("WASM", "crypto module initialised");

  const account      = privateKeyToAccount(`0x${PK.replace(/^0x/, "")}` as `0x${string}`);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL), chain: aeneid });
  const storyClient  = StoryClient.newClient({ transport: http(RPC_URL), account, chainId: "aeneid" });
  const cdrClient    = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: API_URL });

  log("Wallet", `creator = ${account.address}`);

  // ── Step 1: SPG NFT Collection ─────────────────────────────────────────────
  stepHdr(1, "SPG NFT Collection");

  let collectionAddr: `0x${string}`;
  const existingCollection = process.env.SPG_NFT_CONTRACT as `0x${string}` | undefined;

  if (existingCollection) {
    collectionAddr = existingCollection;
    log("SPG NFT", `reusing collection ${collectionAddr}`);
  } else {
    const r = await storyClient.nftClient.createNFTCollection({
      name: "Backstage Works",
      symbol: "BACK",
      isPublicMinting: false,
      mintOpen: true,
      mintFeeRecipient: account.address,
      contractURI: "",
    });
    collectionAddr = r.spgNftContract!;
    log("SPG NFT", `deployed ${collectionAddr}`, r.txHash);
    // Persist for reruns so we don't re-deploy on every run
    const envPath = resolve(__dirname, "../.env");
    writeFileSync(envPath, readFileSync(envPath, "utf8") + `\nSPG_NFT_CONTRACT=${collectionAddr}\n`);
  }

  // ── Step 2: IP Asset + 3 PIL Terms ────────────────────────────────────────
  stepHdr(2, "Mint IP Asset + register 3 PIL tiers");

  const ipMeta = {
    title:       "Moonrise — Unreleased Demo",
    description: "A studio demo track — Backstage hackathon test asset.",
    image:       "ipfs://bafybeibwzifw52ttrkqlikfzext5akxu7lz4xiwjgwzmqcpdzmp3n5z3uq",
    mediaType:   "audio/mp3",
    creators:    [{ name: "Demo Artist", address: account.address, contributionPercent: 100 }],
  };
  const ipMetaJSON = JSON.stringify(ipMeta);

  const regResult = await storyClient.ipAsset.mintAndRegisterIpAssetWithPilTerms({
    spgNftContract: collectionAddr,
    allowDuplicates: true,
    licenseTermsData: [
      // Tier 0 — Stream: listen only, 0.01 WIP
      { terms: PILFlavor.commercialUse({
          defaultMintingFee: parseEther("0.01"),
          currency: WIP_TOKEN,
          royaltyPolicy: NativeRoyaltyPolicy.LAP,
        }) },
      // Tier 1 — Download: personal use, 0.05 WIP
      { terms: PILFlavor.commercialUse({
          defaultMintingFee: parseEther("0.05"),
          currency: WIP_TOKEN,
          royaltyPolicy: NativeRoyaltyPolicy.LAP,
        }) },
      // Tier 2 — Commercial: full rights + remix, 0.1 WIP + 10% rev share
      { terms: PILFlavor.commercialRemix({
          defaultMintingFee: parseEther("0.1"),
          currency: WIP_TOKEN,
          royaltyPolicy: NativeRoyaltyPolicy.LAP,
          commercialRevShare: 10,
        }) },
    ],
    ipMetadata: {
      ipMetadataURI:  `data:application/json;base64,${Buffer.from(ipMetaJSON).toString("base64")}`,
      ipMetadataHash: keccak256(toBytes(ipMetaJSON)),
      nftMetadataURI:  `data:application/json;base64,${Buffer.from("{}").toString("base64")}`,
      nftMetadataHash: keccak256(toBytes("{}")),
    },
  });

  const ipId              = regResult.ipId!;
  const licenseTermsIds   = regResult.licenseTermsIds!;
  const [streamId, downloadId, commercialId] = licenseTermsIds;

  log("IP Asset",  `ipId = ${ipId}`, regResult.txHash);
  log("PIL Terms", `stream=${streamId}  download=${downloadId}  commercial=${commercialId}`);

  // ── Step 3: Preview → plain IPFS (local daemon) ───────────────────────────
  stepHdr(3, "Upload preview to plain IPFS");

  const storage = new GatewayProvider({ apiUrl: IPFS_API_URL, gatewayUrl: IPFS_GW_URL });

  const trackBytes = new Uint8Array(readFileSync(resolve(__dirname, "../assets/track.mp3")));
  const stemsBytes = new Uint8Array(readFileSync(resolve(__dirname, "../assets/stems.mp3")));

  // Preview = first 30s ≈ first 480 KB at 128 kbps
  const previewBytes = trackBytes.slice(0, Math.min(trackBytes.length, 480_000));
  const previewCid = await storage.upload(previewBytes, { pin: true });
  log("Preview", `CID=${previewCid}  (${(previewBytes.length / 1024).toFixed(0)} KB, local IPFS)`);

  const globalPubKey = await cdrClient.observer.getGlobalPubKey();
  log("CDR", "DKG global public key fetched");

  const writeCondData = encodeAbiParameters([{ type: "address" }], [account.address]);

  // ── Step 4: Full track → CDR vault (stream-tier gate) ─────────────────────
  stepHdr(4, "Upload full track to CDR vault (stream-gated)");
  console.log(`  Encrypting + uploading ${(trackBytes.length / 1e6).toFixed(2)} MB…`);

  const fullReadCondData = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    [LICENSE_TOKEN, ipId, streamId],
  );
  const fullResult = await cdrClient.uploader.uploadFile({
    content:            trackBytes,
    storageProvider:    storage,
    globalPubKey,
    updatable:          false,
    writeConditionAddr: OWNER_WRITE_COND,
    writeConditionData: writeCondData,
    readConditionAddr:  TIERED_READ_COND,
    readConditionData:  fullReadCondData,
    accessAuxData:      "0x",
  });
  log("CDR Full", `uuid=${fullResult.uuid}  cid=${fullResult.cid}`, fullResult.txHashes.write);

  // ── Step 5: Stems → CDR vault (commercial-tier gate) ─────────────────────
  stepHdr(5, "Upload stems to CDR vault (commercial-gated)");
  console.log(`  Encrypting + uploading ${(stemsBytes.length / 1e6).toFixed(2)} MB…`);

  const stemsReadCondData = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }],
    [LICENSE_TOKEN, ipId, commercialId],
  );
  const stemsResult = await cdrClient.uploader.uploadFile({
    content:            stemsBytes,
    storageProvider:    storage,
    globalPubKey,
    updatable:          false,
    writeConditionAddr: OWNER_WRITE_COND,
    writeConditionData: writeCondData,
    readConditionAddr:  TIERED_READ_COND,
    readConditionData:  stemsReadCondData,
    accessAuxData:      "0x",
  });
  log("CDR Stems", `uuid=${stemsResult.uuid}  cid=${stemsResult.cid}`, stemsResult.txHashes.write);

  // ── Step 6: Register in BackstageRegistry ─────────────────────────────────
  stepHdr(6, "Register work in BackstageRegistry");

  const regTxHash = await walletClient.writeContract({
    address:      REGISTRY_ADDR,
    abi:          REGISTRY_ABI,
    functionName: "registerWork",
    args: [
      ipId,
      previewCid,
      [fullResult.uuid, stemsResult.uuid],
      [streamId, downloadId, commercialId],
      `data:application/json;base64,${Buffer.from(ipMetaJSON).toString("base64")}`,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: regTxHash });
  log("Registry", `work registered`, regTxHash);

  // ── Step 7: Write output ──────────────────────��───────────────────────────
  mkdirSync(resolve(__dirname, "../output"), { recursive: true });
  const outPath = resolve(__dirname, "../output/publish-result.json");
  writeFileSync(outPath, JSON.stringify({
    ipId,
    collectionAddr,
    streamTermsId:     streamId.toString(),
    downloadTermsId:   downloadId.toString(),
    commercialTermsId: commercialId.toString(),
    fullTrackUuid:     fullResult.uuid,
    fullTrackCid:      fullResult.cid,
    stemsUuid:         stemsResult.uuid,
    stemsCid:          stemsResult.cid,
    previewCid,
    createdAt:         new Date().toISOString(),
  }, null, 2));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ✅  Done in ${elapsed}s`);
  console.log(`${"═".repeat(64)}`);
  console.log(`\n  IP Asset:        ${ipId}`);
  console.log(`  Stream TermsId:  ${streamId}`);
  console.log(`  Full Track UUID: ${fullResult.uuid}  (CDR, stream-gated)`);
  console.log(`  Stems UUID:      ${stemsResult.uuid}  (CDR, commercial-gated)`);
  console.log(`  Preview CID:     ${previewCid}  (plain IPFS)`);
  console.log(`\n  Output → ${outPath}`);
  console.log(`  Next   → pnpm buy-unlock\n`);
}

main().catch((err) => { console.error("\n❌", err); process.exit(1); });
