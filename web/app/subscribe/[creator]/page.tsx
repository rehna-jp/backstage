"use client";

import { useState, use } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { cn } from "@/lib/utils";
import { shortenAddress } from "@/lib/utils";

const SUBSCRIPTION_NFT_ABI = [
  {
    name: "mintPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "subscribe",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
] as const;

export default function SubscribePage({ params }: { params: Promise<{ creator: string }> }) {
  const { creator } = use(params);
  const creatorAddress = creator as `0x${string}`;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [status, setStatus] = useState<"idle" | "minting" | "done" | "error">("idle");
  const [errorMsg, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  const nftContract = (process.env.NEXT_PUBLIC_SUBSCRIPTION_NFT_DEMO ?? "") as `0x${string}`;

  const { data: mintPrice } = useReadContract({
    address: nftContract,
    abi: SUBSCRIPTION_NFT_ABI,
    functionName: "mintPrice",
  });

  const { data: nftName } = useReadContract({
    address: nftContract,
    abi: SUBSCRIPTION_NFT_ABI,
    functionName: "name",
  });

  const { data: totalSupply } = useReadContract({
    address: nftContract,
    abi: SUBSCRIPTION_NFT_ABI,
    functionName: "totalSupply",
  });

  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: nftContract,
    abi: SUBSCRIPTION_NFT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const alreadySubscribed = !!userBalance && userBalance > 0n;

  async function handleSubscribe() {
    if (!address || !publicClient) return;
    setStatus("minting");
    setError("");

    try {
      const price = mintPrice ?? 0n;
      const hash = await writeContractAsync({
        address: nftContract,
        abi: SUBSCRIPTION_NFT_ABI,
        functionName: "subscribe",
        args: [address],
        value: price,
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchBalance();
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="mb-2">
          <Link href="/" className="text-sm text-[--color-text-muted] hover:text-[--color-text-secondary] transition-colors">
            ← Back
          </Link>
        </div>

        <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-8 text-center">
          {/* Creator avatar placeholder */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[--color-accent-glow] border border-[--color-accent]/30">
            <span className="text-2xl">🎵</span>
          </div>

          <h1 className="text-xl font-bold text-[--color-text-primary] mb-1">
            {nftName ?? "Subscriber Pass"}
          </h1>
          <p className="text-sm text-[--color-text-secondary] mb-1">
            Creator: <span className="font-mono">{shortenAddress(creatorAddress)}</span>
          </p>
          {totalSupply !== undefined && (
            <p className="text-xs text-[--color-text-muted] mb-6">
              {totalSupply.toString()} subscriber{totalSupply !== 1n ? "s" : ""} so far
            </p>
          )}

          <div className="rounded-xl border border-[--color-border] bg-[--color-surface-2] p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-[--color-text-secondary] uppercase tracking-wider mb-2">What you get</p>
            <ul className="space-y-1 text-sm text-[--color-text-secondary]">
              <li>✓ Early access to time-locked drops</li>
              <li>✓ Exclusive subscriber-only content</li>
              <li>✓ On-chain proof of support</li>
            </ul>
          </div>

          {mintPrice !== undefined && (
            <div className="flex items-center justify-between mb-6 px-1">
              <span className="text-sm text-[--color-text-secondary]">Subscription price</span>
              <span className="text-lg font-bold text-[--color-text-primary]">
                {formatEther(mintPrice)} IP
              </span>
            </div>
          )}

          {!isConnected ? (
            <p className="text-sm text-[--color-text-muted]">Connect your wallet to subscribe.</p>
          ) : alreadySubscribed ? (
            <div className="rounded-xl bg-[--color-green]/10 border border-[--color-green]/30 px-4 py-3">
              <p className="text-sm font-semibold text-[--color-green]">✓ You&apos;re already subscribed</p>
              <p className="text-xs text-[--color-text-muted] mt-1">Your pass unlocks early-access drops automatically.</p>
            </div>
          ) : status === "done" ? (
            <div className="rounded-xl bg-[--color-green]/10 border border-[--color-green]/30 px-4 py-3">
              <p className="text-sm font-semibold text-[--color-green]">✓ Subscribed!</p>
              {txHash && (
                <a
                  href={`https://aeneid.storyscan.xyz/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[--color-accent] hover:underline"
                >
                  View transaction ↗
                </a>
              )}
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={status === "minting"}
              className={cn(
                "w-full rounded-xl py-3 font-semibold text-sm transition-all",
                status === "minting"
                  ? "bg-[--color-accent]/60 text-white cursor-wait"
                  : "bg-[--color-accent] text-white hover:bg-[--color-accent-dim]"
              )}
            >
              {status === "minting" ? "Minting pass…" : "Subscribe"}
            </button>
          )}

          {status === "error" && (
            <p className="mt-3 text-xs text-[--color-red] break-all">{errorMsg}</p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[--color-text-muted]">
          Your subscriber pass is an ERC-721 token on Story Aeneid. It grants early access
          to time-locked drops by creators using{" "}
          <span className="font-mono">TimeWindowedReadCondition</span>.
        </p>
      </main>
    </>
  );
}
