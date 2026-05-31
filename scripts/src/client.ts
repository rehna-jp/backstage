import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
import { StoryClient } from "@story-protocol/core-sdk";

const RPC_URL = process.env.AENEID_RPC_URL ?? "https://aeneid.storyrpc.io";
const API_URL = process.env.STORY_API_URL ?? "http://172.192.41.96:1317";

const PK = process.env.WALLET_PRIVATE_KEY;
if (!PK) {
  throw new Error("WALLET_PRIVATE_KEY missing — copy .env.example to .env and fill it in.");
}

export const account = privateKeyToAccount(`0x${PK.replace(/^0x/, "")}`);

export const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  transport: http(RPC_URL),
});

export const cdrClient = new CDRClient({
  network: "testnet",
  publicClient,
  walletClient,
  apiUrl: API_URL,
});

export const storyClient = StoryClient.newClient({
  transport: http(RPC_URL),
  account,
  chainId: "aeneid",
});

// Call once before any encrypt/decrypt
export async function ready(): Promise<void> {
  await initWasm();
}

// ── Addresses ──────────────────────────────────────────────────────────────
export const ADDRESSES = {
  // Story Protocol (Aeneid) — sourced from storyprotocol/sdk generated.ts
  WIP_TOKEN:          "0x1514000000000000000000000000000000000000" as `0x${string}`,
  LICENSE_TOKEN:      "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`,
  LICENSING_MODULE:   "0x04fbd8a2e56dd85CFD5500A4A4DfA955B9f1dE6f" as `0x${string}`,
  ROYALTY_MODULE:     "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086" as `0x${string}`,
  PIL_TEMPLATE:       "0x2E896b0b2Fdb7457499B56AAaA4AE55BCB4Cd316" as `0x${string}`,
  IP_ASSET_REGISTRY:  "0x77319B4031e6eF1250907aa00018B8B1c67a244b" as `0x${string}`,
  // CDR conditions (Aeneid)
  OWNER_WRITE_COND:   "0x4C9bFC96d7092b590D497A191826C3dA2277c34B" as `0x${string}`,
  LICENSE_READ_COND:  "0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3" as `0x${string}`,
  // Backstage custom contracts — populated from env after deployment
  TIERED_READ_COND:   (process.env.TIERED_LICENSE_READ_CONDITION ?? "") as `0x${string}`,
  TIME_WINDOWED_COND: (process.env.TIME_WINDOWED_READ_CONDITION ?? "") as `0x${string}`,
  BACKSTAGE_REGISTRY: (process.env.BACKSTAGE_REGISTRY ?? "") as `0x${string}`,
} as const;
