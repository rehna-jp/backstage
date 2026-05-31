import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const aeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_AENEID_RPC_URL ?? "https://aeneid.storyrpc.io"] },
  },
  blockExplorers: {
    default: { name: "StoryScan", url: "https://aeneid.storyscan.xyz" },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: "Backstage",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "backstage-hackathon",
  chains: [aeneid],
  transports: { [aeneid.id]: http() },
  ssr: true,
});

// ── Addresses (sourced from .env, mirroring scripts/src/client.ts) ──────────
export const ADDRESSES = {
  WIP_TOKEN:           "0x1514000000000000000000000000000000000000" as `0x${string}`,
  LICENSE_TOKEN:       "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC" as `0x${string}`,
  ROYALTY_MODULE:      "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086" as `0x${string}`,
  PIL_TEMPLATE:        "0x2E896b0b2Fdb7457499B56AAaA4AE55BCB4Cd316" as `0x${string}`,
  OWNER_WRITE_COND:    "0x4C9bFC96d7092b590D497A191826C3dA2277c34B" as `0x${string}`,
  LICENSE_READ_COND:   "0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3" as `0x${string}`,
  TIERED_READ_COND:    (process.env.NEXT_PUBLIC_TIERED_LICENSE_READ_CONDITION ?? "0x") as `0x${string}`,
  BACKSTAGE_REGISTRY:  (process.env.NEXT_PUBLIC_BACKSTAGE_REGISTRY ?? "0x") as `0x${string}`,
} as const;
