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
  "text-[--color-accent] bg-[--color-accent-glow]",
  "text-[--color-amber] bg-amber-500/10",
  "text-[--color-green] bg-green-500/10",
] as const;

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[--color-border] bg-[--color-surface] px-5 py-4">
      <p className="text-xs uppercase tracking-widest text-[--color-text-muted]">{label}</p>
      <p className="mt-1 text-3xl font-bold text-[--color-text-primary]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
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
        <main className="mx-auto max-w-2xl px-6 py-24 text-center space-y-6">
          <h1 className="text-3xl font-bold text-[--color-text-primary]">Creator Dashboard</h1>
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
            <h1 className="text-3xl font-bold text-[--color-text-primary]">Your Dashboard</h1>
            <p className="mt-1 text-sm text-[--color-text-muted] font-mono">{address}</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-[--color-border] px-4 py-2 text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] hover:border-[--color-accent]/50 transition-colors"
          >
            Browse Marketplace ↗
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          <StatCard label="Works Published" value={isLoading ? "—" : works.length} />
          <StatCard label="CDR Vaults"      value={isLoading ? "—" : totalVaults} />
          <StatCard label="License Tiers"   value={isLoading ? "—" : totalTiers} />
        </div>

        {/* Works list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[--color-surface]" />
            ))}
          </div>
        ) : works.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[--color-border] py-24 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 text-[--color-text-muted]">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <p className="text-[--color-text-secondary]">No works published yet.</p>
            <p className="mt-1 text-sm text-[--color-text-muted]">
              Run <code className="font-mono text-xs">pnpm publish-work</code> from the scripts package.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {works.map(({ id, work }) => {
              const title = titles[id] || `Work #${id}`;
              const cover = covers[id] ?? null;
              const createdDate = new Date(Number(work.createdAt) * 1000).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              });

              return (
                <div
                  key={id}
                  className="group flex items-center gap-5 rounded-xl border border-[--color-border] bg-[--color-surface] p-4 hover:border-[--color-accent]/40 transition-colors"
                >
                  {/* Cover */}
                  <div className="relative shrink-0 h-14 w-14 overflow-hidden rounded-lg bg-[--color-surface-2]">
                    {cover ? (
                      <Image src={cover} alt={title} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--color-text-muted]">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/works/${id}`}
                        className="font-semibold text-[--color-text-primary] hover:text-[--color-accent] truncate transition-colors"
                        style={{ fontFamily: "var(--font-space-grotesk)" }}
                      >
                        {title}
                      </Link>
                      <span className="shrink-0 rounded-full bg-[--color-surface-2] px-2 py-0.5 text-xs text-[--color-text-muted]">
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
                        IP: {shortenAddress(work.ipId)} ↗
                      </a>
                      <span>{work.gatedVaultUuids.length} vault{work.gatedVaultUuids.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Tier badges */}
                  <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
                    {work.licenseTermsIds.map((termsId, i) => (
                      <span
                        key={i}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_COLORS[i] ?? "text-[--color-text-muted] bg-[--color-surface-2]"}`}
                      >
                        {TIER_LABELS[i] ?? `Tier ${i}`}
                      </span>
                    ))}
                  </div>

                  {/* Vault UUIDs */}
                  {work.gatedVaultUuids.length > 0 && (
                    <div className="shrink-0 hidden lg:block text-right">
                      <p className="text-xs text-[--color-text-muted] mb-0.5">CDR Vault{work.gatedVaultUuids.length > 1 ? "s" : ""}</p>
                      {work.gatedVaultUuids.map((uuid) => (
                        <p key={uuid} className="font-mono text-xs text-[--color-text-secondary]">
                          #{uuid}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
