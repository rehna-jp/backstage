"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { NavBar } from "@/components/NavBar";
import { ADDRESSES, REGISTRY_ABI, type Work } from "@/lib/contracts";
import { shortenAddress } from "@/lib/utils";

export default function VerifyPage() {
  const [workIdInput, setWorkIdInput] = useState("");
  const [queried, setQueried] = useState<bigint | null>(null);

  const { data: work, isLoading, error } = useReadContract({
    address: ADDRESSES.BACKSTAGE_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getWork",
    args: [queried ?? BigInt(0)],
    query: { enabled: queried !== null },
  }) as { data: Work | undefined; isLoading: boolean; error: Error | null };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(workIdInput, 10);
    if (!isNaN(n) && n >= 0) setQueried(BigInt(n));
  }

  const tierLabels = ["Stream", "Download", "Commercial"];

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-xl px-6 py-16 space-y-8">
        <div>
          <h1
            className="text-3xl font-bold text-[--color-text-primary]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Verify License
          </h1>
          <p className="mt-2 text-[--color-text-secondary]">
            Look up any registered work and its on-chain license tiers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="number"
            min={0}
            placeholder="Work ID (e.g. 0)"
            value={workIdInput}
            onChange={(e) => setWorkIdInput(e.target.value)}
            className="flex-1 rounded-lg border border-[--color-border] bg-[--color-surface] px-4 py-2 text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] focus:border-[--color-accent] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-[--color-accent] px-5 py-2 text-sm font-semibold text-white hover:bg-[--color-accent-dim] transition-colors"
          >
            Verify
          </button>
        </form>

        {isLoading && (
          <div className="h-40 animate-pulse rounded-xl bg-[--color-surface]" />
        )}

        {error && queried !== null && (
          <div className="rounded-xl border border-[--color-red]/30 bg-[--color-red]/10 px-4 py-3 text-sm text-[--color-red]">
            Work #{queried.toString()} not found on BackstageRegistry.
          </div>
        )}

        {work && queried !== null && (
          <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[--color-text-primary]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                Work #{queried.toString()}
              </h2>
              <span className="rounded-full bg-[--color-green]/15 px-3 py-0.5 text-xs text-[--color-green]">
                ✓ Registered
              </span>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[--color-text-muted]">Creator</dt>
                <dd className="font-mono text-xs text-[--color-text-secondary]">{work.creator}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[--color-text-muted]">IP Asset</dt>
                <dd>
                  <a
                    href={`https://aeneid.storyscan.xyz/address/${work.ipId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-[--color-accent] hover:underline"
                  >
                    {shortenAddress(work.ipId)} ↗
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[--color-text-muted]">CDR Vaults</dt>
                <dd className="text-[--color-text-secondary]">{work.gatedVaultUuids.length} vault(s)</dd>
              </div>
            </dl>

            <div>
              <p className="mb-2 text-xs text-[--color-text-muted] uppercase tracking-widest">License Tiers</p>
              <div className="space-y-2">
                {work.licenseTermsIds.map((termsId, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-[--color-border] bg-[--color-surface-2] px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-[--color-text-primary]">
                      {tierLabels[i] ?? `Tier ${i}`}
                    </span>
                    <span className="font-mono text-xs text-[--color-text-muted]">
                      terms #{termsId.toString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
