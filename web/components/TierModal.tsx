"use client";

import { useState } from "react";
import { useAccount, useWalletClient, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { encodeAbiParameters, parseEther } from "viem";
import { CDRClient, GatewayProvider } from "@piplabs/cdr-sdk";
import { ADDRESSES, WIP_ABI, LICENSING_MODULE_ABI, type Work, TIER_LABELS, type TierIndex } from "@/lib/contracts";
import { cn } from "@/lib/utils";

type Step = "idle" | "wrapping" | "approving" | "minting" | "unlocking" | "done" | "error";

type Props = {
  work: Work;
  onUnlocked: (bytes: Uint8Array, tier: TierIndex) => void;
};

const TIER_DESCRIPTIONS = [
  { label: "Stream",     desc: "Listen to the full track, non-commercial use only.",     icon: "🎧" },
  { label: "Download",   desc: "Download stems and the full track for personal use.",     icon: "⬇️" },
  { label: "Commercial", desc: "Full commercial rights — sync, remix, release.",           icon: "💼" },
];

const WIP_WRAP_AMOUNT = parseEther("2");

export function TierModal({ work, onUnlocked }: Props) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [selectedTier, setSelectedTier] = useState<TierIndex | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const availableTiers = Math.min(work.licenseTermsIds.length, 3) as 0 | 1 | 2 | 3;

  async function handleBuy(tierIndex: TierIndex) {
    if (!address || !walletClient || !publicClient) return;
    setSelectedTier(tierIndex);
    setStep("wrapping");
    setErrorMsg("");

    try {
      // ── Step 1: Wrap IP → WIP ────────────────────────────────────────────────
      setStepLabel("Wrapping IP → WIP…");
      const wrapHash = await writeContractAsync({
        address: ADDRESSES.WIP_TOKEN,
        abi: WIP_ABI,
        functionName: "deposit",
        value: WIP_WRAP_AMOUNT,
      });
      await publicClient.waitForTransactionReceipt({ hash: wrapHash });

      // ── Step 2: Approve RoyaltyModule ────────────────────────────────────────
      setStep("approving");
      setStepLabel("Approving RoyaltyModule…");
      const approveHash = await writeContractAsync({
        address: ADDRESSES.WIP_TOKEN,
        abi: WIP_ABI,
        functionName: "approve",
        args: [ADDRESSES.ROYALTY_MODULE, WIP_WRAP_AMOUNT],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // ── Step 3: Mint license token ───────────────────────────────────────────
      setStep("minting");
      setStepLabel("Minting license token…");
      const mintHash = await writeContractAsync({
        address: ADDRESSES.LICENSING_MODULE,
        abi: LICENSING_MODULE_ABI,
        functionName: "mintLicenseTokens",
        args: [
          work.ipId,
          ADDRESSES.PIL_TEMPLATE,
          work.licenseTermsIds[tierIndex],
          BigInt(1),
          address,
          "0x",
          BigInt(0),
          0,
        ],
      });
      const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });

      // Extract tokenId from Transfer event logs (ERC721 Transfer = topics[3])
      const transferLog = mintReceipt.logs.find(
        (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      const licenseTokenId = transferLog?.topics[3]
        ? BigInt(transferLog.topics[3])
        : BigInt(0);

      // ── Step 4: CDR unlock ───────────────────────────────────────────────────
      setStep("unlocking");
      setStepLabel("Decrypting vault via CDR…");

      const accessAuxData = encodeAbiParameters(
        [{ type: "uint256[]" }],
        [[licenseTokenId]],
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cdrClient = new CDRClient({
        network: "testnet",
        publicClient: publicClient as any,
        walletClient: walletClient as any,
        apiUrl: process.env.NEXT_PUBLIC_CDR_API_URL ?? "http://172.192.41.96:1317",
      });

      const storage = new GatewayProvider({
        apiUrl:     "https://ipfs.io",
        gatewayUrl: "https://ipfs.io/ipfs",
      });

      const vaultUuid = work.gatedVaultUuids[0];
      const { content } = await cdrClient.consumer.downloadFile({
        uuid:            vaultUuid,
        accessAuxData,
        storageProvider: storage,
        timeoutMs:       120_000,
      });

      setStep("done");
      onUnlocked(content, tierIndex);
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  const isBusy = !["idle", "done", "error"].includes(step);

  return (
    <div className="space-y-3">
      {Array.from({ length: availableTiers }).map((_, i) => {
        const tier = i as TierIndex;
        const info = TIER_DESCRIPTIONS[i];
        const isSelected = selectedTier === tier;
        const isBuying = isSelected && isBusy;

        return (
          <div
            key={tier}
            className={cn(
              "rounded-xl border p-4 transition-colors",
              isSelected && isBusy
                ? "border-[--color-accent] bg-[--color-accent-glow]"
                : "border-[--color-border] bg-[--color-surface-2]"
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{info.icon}</span>
                <div>
                  <p className="font-semibold text-sm text-[--color-text-primary]">{info.label}</p>
                  <p className="text-xs text-[--color-text-secondary]">{info.desc}</p>
                </div>
              </div>

              <button
                onClick={() => handleBuy(tier)}
                disabled={isBusy || step === "done"}
                className={cn(
                  "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                  step === "done" && isSelected
                    ? "bg-[--color-green] text-white cursor-default"
                    : isBuying
                    ? "bg-[--color-accent]/60 text-white cursor-wait"
                    : "bg-[--color-accent] text-white hover:bg-[--color-accent-dim] disabled:opacity-40"
                )}
              >
                {step === "done" && isSelected
                  ? "✓ Unlocked"
                  : isBuying
                  ? stepLabel
                  : "Get Access"}
              </button>
            </div>

            {isSelected && step === "error" && (
              <p className="mt-2 text-xs text-[--color-red] break-all">{errorMsg}</p>
            )}
          </div>
        );
      })}

      {availableTiers === 0 && (
        <p className="text-sm text-[--color-text-muted]">No license tiers available for this work yet.</p>
      )}
    </div>
  );
}
