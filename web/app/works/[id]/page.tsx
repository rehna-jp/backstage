"use client";

import { useEffect, useState, use } from "react";
import { useReadContract } from "wagmi";
import Image from "next/image";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TierModal } from "@/components/TierModal";
import { ADDRESSES, REGISTRY_ABI, type Work, type WorkMeta, type TierIndex } from "@/lib/contracts";
import { ipfsUrl, fetchMetadata } from "@/lib/ipfs";
import { shortenAddress } from "@/lib/utils";

export default function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const workId = BigInt(id);

  const [meta, setMeta] = useState<WorkMeta | null>(null);
  const [unlockedAudio, setUnlockedAudio] = useState<Uint8Array | null>(null);
  const [unlockedTier, setUnlockedTier] = useState<TierIndex | null>(null);

  const { data: work, isLoading, error } = useReadContract({
    address: ADDRESSES.BACKSTAGE_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getWork",
    args: [workId],
  }) as { data: Work | undefined; isLoading: boolean; error: Error | null };

  useEffect(() => {
    if (!work?.metadataURI) return;
    fetchMetadata(work.metadataURI)
      .then((raw) => setMeta({
        title:       String(raw.title ?? ""),
        description: String(raw.description ?? ""),
        image:       String(raw.image ?? ""),
      }))
      .catch(() => {});
  }, [work?.metadataURI]);

  if (isLoading) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-5xl px-6 py-16 space-y-6">
          <div className="h-6 w-24 animate-pulse rounded-lg bg-[--color-surface-2]" />
          <div className="flex gap-8">
            <div className="h-60 w-60 shrink-0 animate-pulse rounded-2xl bg-[--color-surface-2]" />
            <div className="flex-1 space-y-4 pt-2">
              <div className="h-8 w-64 animate-pulse rounded-lg bg-[--color-surface-2]" />
              <div className="h-4 w-32 animate-pulse rounded-lg bg-[--color-surface-2]" />
              <div className="h-4 w-full animate-pulse rounded-lg bg-[--color-surface-2]" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error || !work) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-5xl px-6 py-24 text-center">
          <p className="text-[--color-red]">Work not found.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-[--color-accent] hover:underline">← Back to marketplace</Link>
        </main>
      </>
    );
  }

  const cover = meta?.image ? ipfsUrl(meta.image) : null;
  const title = meta?.title || `Work #${id}`;
  const previewUrl = work.previewCID ? ipfsUrl(work.previewCID) : null;
  const TIER_NAMES = ["Stream", "Download", "Commercial"];

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">

        {/* Breadcrumb */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 2L4 7l5 5"/>
          </svg>
          Marketplace
        </Link>

        {/* Hero */}
        <div className="flex gap-8 flex-col sm:flex-row items-start">
          {/* Cover art */}
          <div
            className="relative w-full sm:w-56 aspect-square shrink-0 rounded-2xl overflow-hidden bg-[--color-surface-2]"
            style={{ boxShadow: "0 8px 40px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.05)" }}
          >
            {cover ? (
              <Image src={cover} alt={title} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-[--color-surface-2] to-[--color-surface-3]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[--color-text-muted]">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-between gap-5 flex-1">
            <div className="space-y-3">
              <h1
                className="text-3xl sm:text-4xl font-bold text-[--color-text-primary] tracking-tight leading-tight"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                {title}
              </h1>
              <p className="text-sm text-[--color-text-muted]">
                by <span className="text-[--color-text-secondary] font-mono">{shortenAddress(work.creator)}</span>
              </p>
              {meta?.description && (
                <p className="text-sm text-[--color-text-secondary] leading-relaxed max-w-lg">
                  {meta.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[--color-accent]/25 bg-[--color-accent-glow2] px-3 py-1 text-xs font-medium text-[--color-accent]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3z"/>
                </svg>
                CDR Encrypted
              </span>
              <span className="rounded-full border border-[--color-border] bg-[--color-surface-2] px-3 py-1 text-xs font-mono text-[--color-text-muted]">
                IP: {shortenAddress(work.ipId)}
              </span>
              <a
                href={`https://aeneid.storyscan.xyz/address/${work.ipId}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[--color-border] px-3 py-1 text-xs text-[--color-text-muted] hover:text-[--color-accent] hover:border-[--color-accent]/40 transition-colors"
              >
                Explorer ↗
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: players */}
          <div className="lg:col-span-3 space-y-6">
            {previewUrl && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[--color-text-muted]">
                  Free Preview
                </h2>
                <AudioPlayer src={previewUrl} label="30-second clip" />
              </section>
            )}

            {unlockedAudio && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[--color-green]">
                  ✓ Unlocked — {TIER_NAMES[unlockedTier!]} tier
                </h2>
                <AudioPlayer src={unlockedAudio} label="Full track · decrypted via CDR" unlocked />
              </section>
            )}
          </div>

          {/* Right: tier purchase */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-[--color-text-muted]">
              Get Access
            </h2>
            <TierModal work={work} onUnlocked={(b, t) => { setUnlockedAudio(b); setUnlockedTier(t); }} />
          </div>
        </div>
      </main>
    </>
  );
}
