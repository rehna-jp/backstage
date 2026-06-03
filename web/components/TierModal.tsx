"use client";

import { useState } from "react";
import { useAccount, useWalletClient, usePublicClient, useWriteContract, useReadContracts } from "wagmi";
import { encodeAbiParameters, parseEther, formatEther } from "viem";
import { CDRClient, GatewayProvider } from "@piplabs/cdr-sdk";
import { ADDRESSES, WIP_ABI, LICENSING_MODULE_ABI, PIL_TEMPLATE_ABI, type Work, type TierIndex } from "@/lib/contracts";
import { cn } from "@/lib/utils";

type Step = "idle" | "wrapping" | "approving" | "minting" | "unlocking" | "done" | "error";

type Props = {
  work: Work;
  onUnlocked: (bytes: Uint8Array, tier: TierIndex) => void;
};

const TIERS = [
  {
    label: "Stream",
    desc: "Listen to the full track, non-commercial use only.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
      </svg>
    ),
  },
  {
    label: "Download",
    desc: "Download stems and the full track for personal use.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
  {
    label: "Commercial",
    desc: "Full commercial rights — sync, remix, release.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      </svg>
    ),
  },
];

const FLOW_STEPS: { key: Step; label: string }[] = [
  { key: "wrapping",  label: "Wrapping IP → WIP" },
  { key: "approving", label: "Approving spend" },
  { key: "minting",   label: "Minting license token" },
  { key: "unlocking", label: "Decrypting via CDR" },
];

export function TierModal({ work, onUnlocked }: Props) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [selectedTier, setSelectedTier] = useState<TierIndex | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isCreator = !!address && address.toLowerCase() === work.creator.toLowerCase();
  const availableTiers = Math.min(work.licenseTermsIds.length, 3) as 0 | 1 | 2 | 3;

  // Fetch minting fee for each tier from the PIL template
  const { data: termsData } = useReadContracts({
    contracts: Array.from({ length: availableTiers }, (_, i) => ({
      address: ADDRESSES.PIL_TEMPLATE,
      abi: PIL_TEMPLATE_ABI,
      functionName: "getLicenseTerms" as const,
      args: [work.licenseTermsIds[i]] as [bigint],
    })),
    query: { enabled: availableTiers > 0 },
  });

  function getMintingFee(tierIndex: number): bigint {
    const result = termsData?.[tierIndex];
    if (result?.status === "success") {
      const terms = result.result as { defaultMintingFee: bigint };
      return terms.defaultMintingFee;
    }
    // fallback to known defaults
    return [parseEther("0.01"), parseEther("0.05"), parseEther("0.1")][tierIndex] ?? parseEther("0.01");
  }

  function formatFee(tierIndex: number): string {
    const fee = getMintingFee(tierIndex);
    const eth = Number(formatEther(fee));
    return eth === 0 ? "Free" : `${eth % 1 === 0 ? eth.toFixed(0) : eth} IP`;
  }

  const isBusy = !["idle", "done", "error"].includes(step);

  async function handleBuy(tierIndex: TierIndex) {
    if (!address || !walletClient || !publicClient) return;
    setSelectedTier(tierIndex);
    setErrorMsg("");

    try {
      const mintingFee = getMintingFee(tierIndex);

      // Only wrap exactly what's needed for this tier's license fee
      setStep("wrapping");
      const wrapHash = await writeContractAsync({
        address: ADDRESSES.WIP_TOKEN,
        abi: WIP_ABI,
        functionName: "deposit",
        value: mintingFee,
      });
      await publicClient.waitForTransactionReceipt({ hash: wrapHash });

      setStep("approving");
      const approveHash = await writeContractAsync({
        address: ADDRESSES.WIP_TOKEN,
        abi: WIP_ABI,
        functionName: "approve",
        args: [ADDRESSES.ROYALTY_MODULE, mintingFee],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setStep("minting");
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

      const transferLog = mintReceipt.logs.find(
        (l) => l.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
      );
      const licenseTokenId = transferLog?.topics[3]
        ? BigInt(transferLog.topics[3])
        : BigInt(0);

      setStep("unlocking");

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
        apiUrl:     "http://127.0.0.1:5001",
        gatewayUrl: "http://127.0.0.1:8080/ipfs",
      });

      const vaultUuid = work.gatedVaultUuids[tierIndex];
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

  const currentStepIndex = FLOW_STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-3">
      {Array.from({ length: availableTiers }).map((_, i) => {
        const tier = i as TierIndex;
        const info = TIERS[i];
        const isSelected = selectedTier === tier;
        const isBuying = isSelected && isBusy;
        const isDone = isSelected && step === "done";
        const hasError = isSelected && step === "error";
        const price = formatFee(i);

        return (
          <div
            key={tier}
            className={cn(
              "rounded-2xl border p-5 transition-all duration-200",
              isDone
                ? "border-[--color-green]/40 bg-[--color-green]/5"
                : isBuying
                ? "border-[--color-accent]/50 bg-[--color-accent-glow]"
                : "border-[--color-border] bg-[--color-surface-2]"
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    isDone
                      ? "bg-[--color-green]/15 text-[--color-green]"
                      : isBuying
                      ? "bg-[--color-accent]/20 text-[--color-accent]"
                      : "bg-[--color-surface-3] text-[--color-text-secondary]"
                  )}
                >
                  {info.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-[--color-text-primary]">{info.label}</p>
                    <span className={cn(
                      "text-xs font-semibold tabular-nums",
                      isDone ? "text-[--color-green]" : "text-[--color-accent]"
                    )}>
                      {price}
                    </span>
                  </div>
                  <p className="text-xs text-[--color-text-muted] mt-0.5">{info.desc}</p>
                </div>
              </div>

              <button
                onClick={() => handleBuy(tier)}
                disabled={isBusy || step === "done" || isCreator}
                className={cn(
                  "shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                  isCreator
                    ? "bg-[--color-surface-3] text-[--color-text-muted] cursor-not-allowed opacity-60"
                    : isDone
                    ? "bg-[--color-green]/15 text-[--color-green] cursor-default border border-[--color-green]/30"
                    : isBuying
                    ? "bg-[--color-accent]/20 text-[--color-accent] cursor-wait"
                    : step === "done"
                    ? "bg-[--color-surface-3] text-[--color-text-muted] cursor-not-allowed opacity-50"
                    : "text-white"
                )}
                style={!isCreator && !isDone && !isBuying && step !== "done" ? {
                  background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                  boxShadow: "0 0 14px rgb(59 130 246 / 0.25)",
                } : undefined}
              >
                {isCreator ? "Your work" : isDone ? "✓ Unlocked" : isBuying ? "Working…" : "Get Access"}
              </button>
            </div>

            {/* Step progress */}
            {isBuying && (
              <div className="mt-4 pt-4 border-t border-[--color-accent]/20">
                <div className="flex items-center gap-2">
                  {FLOW_STEPS.map((s, idx) => {
                    const done = idx < currentStepIndex;
                    const active = idx === currentStepIndex;
                    return (
                      <div key={s.key} className="flex items-center gap-2 flex-1">
                        <div className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                          done   ? "bg-[--color-green] text-white" :
                          active ? "bg-[--color-accent] text-white animate-pulse" :
                                   "bg-[--color-surface-3] text-[--color-text-muted]"
                        )}>
                          {done ? "✓" : idx + 1}
                        </div>
                        <span className={cn(
                          "text-[10px] leading-tight hidden sm:block",
                          active ? "text-[--color-text-primary] font-medium" : "text-[--color-text-muted]"
                        )}>
                          {s.label}
                        </span>
                        {idx < FLOW_STEPS.length - 1 && (
                          <div className={cn("h-px flex-1 transition-colors", done ? "bg-[--color-green]/40" : "bg-[--color-border]")} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hasError && (
              <p className="mt-3 text-xs text-[--color-red] break-all bg-[--color-red]/5 rounded-lg p-3 border border-[--color-red]/20">
                {errorMsg}
              </p>
            )}
          </div>
        );
      })}

      {availableTiers === 0 && (
        <p className="text-sm text-[--color-text-muted] text-center py-8">No license tiers available for this work yet.</p>
      )}

      {isCreator && availableTiers > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-[--color-border] bg-[--color-surface-2] px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[--color-amber] shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-[--color-text-muted]">
            You published this work. Purchases are open to other wallets.
          </p>
        </div>
      )}

      <p className="text-center text-[10px] text-[--color-text-muted] pt-1">
        + gas fees (Story Aeneid testnet) · IP is wrapped to WIP per transaction
      </p>
    </div>
  );
}
