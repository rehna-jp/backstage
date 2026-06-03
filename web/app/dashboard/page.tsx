"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NavBar } from "@/components/NavBar";
import { ADDRESSES, REGISTRY_ABI, TIER_LABELS, type Work } from "@/lib/contracts";
import { fetchMetadata, ipfsUrl } from "@/lib/ipfs";
import { shortenAddress } from "@/lib/utils";
import Image from "next/image";

const TIER_COLORS = [
  "text-[--color-accent] bg-[--color-accent-glow] border-[--color-accent]/20",
  "text-[--color-amber] bg-amber-500/10 border-amber-500/20",
  "text-[--color-green] bg-green-500/10 border-green-500/20",
] as const;

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-[--color-text-muted]">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[--color-surface-2] text-[--color-text-muted]">
          {icon}
        </div>
      </div>
      <p className="text-4xl font-bold text-[--color-text-primary]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  const { data: workIds, isLoading: loadingIds } = useReadContract({
    address: ADDRESSES.BACKSTAGE_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "listByCreator",
    args: [address!],
    query: { enabled: !!address },
  });

  const workContracts = (workIds ?? []).map((id) => ({
    address: ADDRESSES.BACKSTAGE_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getWork" as const,
    args: [id] as [bigint],
  }));

  const { data: worksRaw, isLoading: loadingWorks } = useReadContracts({
    contracts: workContracts,
    query: { enabled: workContracts.length > 0 },
  });

  const works = (worksRaw ?? [])
    .map((r, i) => ({
      id: Number((workIds ?? [])[i]),
      work: r.status === "success" ? (r.result as Work) : null,
    }))
    .filter((w): w is { id: number; work: Work } => w.work !== null)
    .sort((a, b) => b.id - a.id);

  const [titles, setTitles] = useState<Record<number, string>>({});
  const [covers, setCovers] = useState<Record<number, string>>({});

  const idKey = (workIds ?? []).join(",");
  useEffect(() => {
    if (!worksRaw) return;
    for (const { id, work } of works) {
      if (titles[id] !== undefined) continue;
      fetchMetadata(work.metadataURI)
        .then((m) => {
          setTitles((prev) => ({ ...prev, [id]: String(m.title ?? "") }));
          if (m.image) setCovers((prev) => ({ ...prev, [id]: ipfsUrl(String(m.image)) }));
        })
        .catch(() => setTitles((prev) => ({ ...prev, [id]: "" })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  const totalVaults = works.reduce((s, { work }) => s + work.gatedVaultUuids.length, 0);
  const totalTiers  = works.reduce((s, { work }) => s + work.licenseTermsIds.length, 0);
  const isLoading = loadingIds || (workContracts.length > 0 && loadingWorks);

  if (!isConnected) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-lg px-6 py-32 text-center space-y-6">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-[--color-surface-2]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--color-text-muted]">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[--color-text-primary]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Creator Dashboard
          </h1>
          <p className="text-[--color-text-secondary]">
            Connect your wallet to see the works you've published on Backstage.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-12 space-y-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[--color-text-primary]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
              Dashboard
            </h1>
            <p className="mt-1.5 text-sm font-mono text-[--color-text-muted]">{address}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-[--color-border] px-4 py-2 text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] hover:border-[--color-accent]/30 transition-all"
            >
              Marketplace ↗
            </Link>
            <Link
              href="/upload"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", boxShadow: "0 0 16px rgb(59 130 246 / 0.25)" }}
            >
              + Publish
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Works Published"
            value={isLoading ? "—" : works.length}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>}
          />
          <StatCard
            label="CDR Vaults"
            value={isLoading ? "—" : totalVaults}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          />
          <StatCard
            label="License Tiers"
            value={isLoading ? "—" : totalTiers}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>}
          />
        </div>

        {/* Works list */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[--color-text-muted]">Your Works</h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-[--color-surface]" />
              ))}
            </div>
          ) : works.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[--color-border] py-24 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[--color-surface-2] mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--color-text-muted]">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <p className="font-semibold text-[--color-text-secondary]">No works published yet.</p>
              <p className="mt-1 text-sm text-[--color-text-muted]">
                Run <code className="font-mono text-xs bg-[--color-surface-2] px-1.5 py-0.5 rounded">pnpm publish-work</code> to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {works.map(({ id, work }) => {
                const title = titles[id] || `Work #${id}`;
                const cover = covers[id] ?? null;
                const createdDate = new Date(Number(work.createdAt) * 1000).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                });

                return (
                  <div
                    key={id}
                    className="group flex items-center gap-5 rounded-2xl border border-[--color-border] bg-[--color-surface] p-4 hover:border-[--color-accent]/30 hover:bg-[--color-surface-2] transition-all"
                  >
                    <div className="relative shrink-0 h-14 w-14 overflow-hidden rounded-xl bg-[--color-surface-2]">
                      {cover ? (
                        <Image src={cover} alt={title} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--color-text-muted]">
                            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/works/${id}`}
                          className="font-semibold text-sm text-[--color-text-primary] hover:text-[--color-accent] truncate transition-colors"
                          style={{ fontFamily: "var(--font-space-grotesk)" }}
                        >
                          {title}
                        </Link>
                        <span className="shrink-0 rounded-full bg-[--color-surface-3] border border-[--color-border] px-2 py-0.5 text-[10px] font-mono text-[--color-text-muted]">
                          #{id}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-[--color-text-muted]">
                        <span>{createdDate}</span>
                        <a
                          href={`https://aeneid.storyscan.xyz/address/${work.ipId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono hover:text-[--color-accent] transition-colors"
                        >
                          {shortenAddress(work.ipId)} ↗
                        </a>
                        <span>{work.gatedVaultUuids.length} vault{work.gatedVaultUuids.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
                      {work.licenseTermsIds.map((_, i) => (
                        <span
                          key={i}
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${TIER_COLORS[i] ?? "text-[--color-text-muted] bg-[--color-surface-2] border-[--color-border]"}`}
                        >
                          {TIER_LABELS[i] ?? `Tier ${i}`}
                        </span>
                      ))}
                    </div>

                    {work.gatedVaultUuids.length > 0 && (
                      <div className="shrink-0 hidden lg:block text-right">
                        <p className="text-[10px] text-[--color-text-muted] mb-1 uppercase tracking-wider">CDR Vault{work.gatedVaultUuids.length > 1 ? "s" : ""}</p>
                        {work.gatedVaultUuids.map((uuid) => (
                          <p key={uuid} className="font-mono text-xs text-[--color-text-secondary]">#{uuid}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
