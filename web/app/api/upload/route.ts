export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient, createWalletClient, http,
  encodeAbiParameters, parseEther, defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
import { StoryClient, PILFlavor, NativeRoyaltyPolicy } from "@story-protocol/core-sdk";
import { RawIPFSProvider } from "@/lib/rawIPFSProvider";

// ── Chain ─────────────────────────────────────────────────────────────────────

const aeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: { default: { http: ["https://aeneid.storyrpc.io"] } },
});

// ── Addresses ─────────────────────────────────────────────────────────────────

const ADDRESSES = {
  OWNER_WRITE_COND:   "0x4C9bFC96d7092b590D497A191826C3dA2277c34B" as `0x${string}`,
  TIERED_READ_COND:   (process.env.NEXT_PUBLIC_TIERED_LICENSE_READ_CONDITION ?? "") as `0x${string}`,
  LICENSE_TOKEN:      "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`,
  BACKSTAGE_REGISTRY: (process.env.NEXT_PUBLIC_BACKSTAGE_REGISTRY ?? "") as `0x${string}`,
  WIP_TOKEN:          "0x1514000000000000000000000000000000000000" as `0x${string}`,
  ROYALTY_MODULE:     "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086" as `0x${string}`,
  PIL_TEMPLATE:       "0x2E896b0b2Fdb7457499B56AAaA4AE55BCB4Cd316" as `0x${string}`,
  IP_ASSET_REGISTRY:  "0x77319B4031e6eF1250907aa00018B8B1c67a244b" as `0x${string}`,
} as const;

const REGISTRY_ABI = [
  {
    name: "registerWork",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ipId",            type: "address"   },
      { name: "previewCID",      type: "string"    },
      { name: "gatedVaultUuids", type: "uint32[]"  },
      { name: "licenseTermsIds", type: "uint256[]" },
      { name: "metadataURI",     type: "string"    },
    ],
    outputs: [{ name: "workId", type: "uint256" }],
  },
] as const;

// ── Helper ────────────────────────────────────────────────────────────────────

function log(tag: string, msg: string) {
  console.log(`[upload] ${tag}: ${msg}`);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const pk = process.env.WALLET_PRIVATE_KEY;
  if (!pk) {
    return NextResponse.json({ error: "Server wallet not configured." }, { status: 500 });
  }

  let body: FormData;
  try {
    body = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const title       = (body.get("title") as string | null) ?? "";
  const description = (body.get("description") as string | null) ?? "";
  const streamFee   = parseFloat((body.get("streamFee")   as string | null) ?? "0.01");
  const downloadFee = parseFloat((body.get("downloadFee") as string | null) ?? "0.05");
  const commFee     = parseFloat((body.get("commFee")     as string | null) ?? "0.1");
  const audioFile   = body.get("audio") as File | null;

  if (!title.trim() || !audioFile) {
    return NextResponse.json({ error: "title and audio are required." }, { status: 400 });
  }

  const audioBytes = new Uint8Array(await audioFile.arrayBuffer());

  try {
    await initWasm();
    log("WASM", "initialised");

    const account = privateKeyToAccount(`0x${pk.replace(/^0x/, "")}` as `0x${string}`);
    const publicClient = createPublicClient({ chain: aeneid, transport: http("https://aeneid.storyrpc.io") });
    const walletClient = createWalletClient({ account, chain: aeneid, transport: http("https://aeneid.storyrpc.io") });
    const storyClient  = StoryClient.newClient({ transport: http("https://aeneid.storyrpc.io"), account, chainId: "aeneid" });
    const cdrClient    = new CDRClient({
      network: "testnet",
      publicClient,
      walletClient,
      apiUrl: process.env.NEXT_PUBLIC_CDR_API_URL ?? "http://172.192.41.96:1317",
    });

    const ipfsApiUrl = process.env.IPFS_API_URL     ?? "http://127.0.0.1:5001";
    const ipfsGwUrl  = process.env.IPFS_GATEWAY_URL ?? "http://127.0.0.1:8080/ipfs";
    const storage = new RawIPFSProvider({ apiUrl: ipfsApiUrl, gatewayUrl: ipfsGwUrl });

    // ── Step 1: Register IP Asset ─────────────────────────────────────────────
    log("IP", "minting IP Asset…");
    const spgResult = await storyClient.ipAsset.mintAndRegisterIpAssetWithPilTerms({
      spgNftContract:  (process.env.SPG_NFT_CONTRACT ?? "") as `0x${string}`,
      licenseTermsData: [
        { terms: PILFlavor.commercialUse({
            defaultMintingFee: parseEther(String(streamFee)),
            currency: ADDRESSES.WIP_TOKEN,
            royaltyPolicy: NativeRoyaltyPolicy.LAP,
          }) },
        { terms: PILFlavor.commercialUse({
            defaultMintingFee: parseEther(String(downloadFee)),
            currency: ADDRESSES.WIP_TOKEN,
            royaltyPolicy: NativeRoyaltyPolicy.LAP,
          }) },
        { terms: PILFlavor.commercialRemix({
            defaultMintingFee: parseEther(String(commFee)),
            currency: ADDRESSES.WIP_TOKEN,
            royaltyPolicy: NativeRoyaltyPolicy.LAP,
            commercialRevShare: 10,
          }) },
      ],
      allowDuplicates: true,
      ipMetadata: {
        ipMetadataURI:  "",
        ipMetadataHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        nftMetadataURI:  title,
        nftMetadataHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      },
    });
    const ipId          = spgResult.ipId as `0x${string}`;
    const streamTermsId = spgResult.licenseTermsIds![0];
    const commTermsId   = spgResult.licenseTermsIds![2];
    log("IP", `registered ipId=${ipId}, terms=[${streamTermsId},${spgResult.licenseTermsIds![1]},${commTermsId}]`);

    // ── Step 2: Upload preview to plain IPFS ─────────────────────────────────
    const PREVIEW_BYTES = 480 * 1024;
    const previewBytes  = audioBytes.slice(0, Math.min(PREVIEW_BYTES, audioBytes.length));
    const previewCid    = await storage.upload(previewBytes, { pin: true });
    log("Preview", `CID=${previewCid}`);

    // ── Step 3: Upload full track CDR vault (stream-gated) ────────────────────
    const streamCondData = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint256" }],
      [ADDRESSES.LICENSE_TOKEN, ipId, streamTermsId],
    );
    const creatorCondData = encodeAbiParameters([{ type: "address" }], [account.address]);

    const { uuid: fullUuid } = await cdrClient.uploader.uploadFile({
      content:            audioBytes,
      storageProvider:    storage,
      updatable:          false,
      writeConditionAddr: ADDRESSES.OWNER_WRITE_COND,
      writeConditionData: creatorCondData,
      readConditionAddr:  ADDRESSES.TIERED_READ_COND,
      readConditionData:  streamCondData,
      accessAuxData:      "0x",
    });
    log("CDR Full", `uuid=${fullUuid}`);

    // ── Step 4: Upload stems CDR vault (commercial-gated) ─────────────────────
    const commCondData = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint256" }],
      [ADDRESSES.LICENSE_TOKEN, ipId, commTermsId],
    );
    const { uuid: stemsUuid } = await cdrClient.uploader.uploadFile({
      content:            audioBytes.slice(0, Math.min(1024 * 1024, audioBytes.length)),
      storageProvider:    storage,
      updatable:          false,
      writeConditionAddr: ADDRESSES.OWNER_WRITE_COND,
      writeConditionData: creatorCondData,
      readConditionAddr:  ADDRESSES.TIERED_READ_COND,
      readConditionData:  commCondData,
      accessAuxData:      "0x",
    });
    log("CDR Stems", `uuid=${stemsUuid}`);

    // ── Step 5: Upload metadata to IPFS ──────────────────────────────────────
    const metadata    = JSON.stringify({ title, description, image: "" });
    const metadataCid = await storage.upload(new TextEncoder().encode(metadata), { pin: true });
    const metadataURI = `ipfs://${metadataCid}`;
    log("Metadata", `URI=${metadataURI}`);

    // ── Step 6: Register in BackstageRegistry ────────────────────────────────
    const allTermsIds = spgResult.licenseTermsIds!;
    const hash = await walletClient.writeContract({
      address: ADDRESSES.BACKSTAGE_REGISTRY,
      abi:     REGISTRY_ABI,
      functionName: "registerWork",
      args: [
        ipId,
        previewCid,
        [fullUuid, stemsUuid],
        allTermsIds,
        metadataURI,
      ],
      account,
      chain: aeneid,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const workIdLog = receipt.logs.find(
      (l) => l.address.toLowerCase() === ADDRESSES.BACKSTAGE_REGISTRY.toLowerCase()
    );
    let workId = 0;
    if (workIdLog?.topics[1]) {
      workId = Number(BigInt(workIdLog.topics[1]));
    }
    log("Registry", `workId=${workId}`);

    return NextResponse.json({
      workId,
      ipId,
      previewCid,
      fullUuid,
      stemsUuid,
      metadataURI,
    });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
