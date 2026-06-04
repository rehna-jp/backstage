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
        <div className="h-56 animate-pulse bg-[--color-surface-2]" />
        <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
          <div className="h-6 w-24 animate-pulse rounded-lg bg-[--color-surface-2]" />
          <div className="flex gap-8">
            <div className="h-48 w-48 shrink-0 animate-pulse rounded-2xl bg-[--color-surface-2]" />
            <div className="flex-1 space-y-4 pt-2">
              <div className="h-8 w-64 animate-pulse rounded-lg bg-[--color-surface-2]" />
              <div className="h-4 w-32 animate-pulse rounded-lg bg-[--color-surface-2]" />
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

      {/* Full-width blurred backdrop */}
      <div className="relative h-56 overflow-hidden">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            className="object-cover scale-110"
            style={{ filter: "blur(28px)", transform: "scale(1.15)" }}
            unoptimized
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, #0d1a3a 0%, #1a0d30 40%, #0a1520 100%)",
            }}
          />
        )}
        {/* Gradient fade to page background */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-[--color-background]" />

        {/* Breadcrumb floated over backdrop */}
        <div className="relative z-10 flex items-end h-full px-6 pb-5 mx-auto max-w-5xl">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white/90 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 2L4 7l5 5"/>
            </svg>
            Marketplace
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 pb-16 space-y-10 -mt-2">

        {/* Hero row — cover art + info */}
        <div className="flex gap-7 flex-col sm:flex-row items-start">
          {/* Cover art */}
          <div
            className="relative w-36 h-36 sm:w-48 sm:h-48 shrink-0 rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 12px 48px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.06)" }}
          >
            {cover ? (
              <Image src={cover} alt={title} fill className="object-cover" unoptimized />
            ) : (
              <div
                className="flex h-full items-center justify-center"
                style={{ background: "linear-gradient(135deg, #141428 0%, #1a1232 60%, #0e1a30 100%)" }}
              >
                <svg width="52" height="38" viewBox="0 0 56 40" fill="none">
                  {[4, 8, 16, 24, 20, 32, 24, 16, 8, 4].map((h, i) => (
                    <rect key={i} x={i * 5.5 + 1} y={(40 - h) / 2} width="3.5" height={h} rx="2"
                      fill={`rgb(79 142 247 / ${0.25 + (i % 3) * 0.15})`} />
                  ))}
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-end gap-4 flex-1 pb-1">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[--color-text-muted]">
                Single
              </p>
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
                <p className="text-sm text-[--color-text-secondary] leading-relaxed max-w-lg pt-1">
                  {meta.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[--color-accent]/25 bg-[--color-accent-glow2] px-3 py-1 text-xs font-medium text-[--color-accent]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3z"/>
                </svg>
                CDR Encrypted
              </span>
              <a
                href={`https://aeneid.storyscan.xyz/address/${work.ipId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[--color-border] bg-[--color-surface-2] px-3 py-1 text-xs font-mono text-[--color-text-muted] hover:text-[--color-accent] hover:border-[--color-accent]/40 transition-colors"
              >
                IP: {shortenAddress(work.ipId)} ↗
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[--color-border-subtle]" />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: players */}
          <div className="lg:col-span-3 space-y-7">
            {previewUrl && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[--color-text-muted]">
                  Free Preview
                </h2>
                <AudioPlayer src={previewUrl} label="30-second clip" />
              </section>
            )}

            {unlockedAudio && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[--color-green]">
                  ✓ Unlocked — {TIER_NAMES[unlockedTier!]} tier
                </h2>
                <AudioPlayer src={unlockedAudio} label="Full track · decrypted via CDR" unlocked />
              </section>
            )}

            {!unlockedAudio && (
              <div className="rounded-2xl border border-dashed border-[--color-border] p-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--color-surface-2] mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--color-text-muted]">
                    <path d="M12 2a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V7a5 5 0 0 0-5-5z"/>
                  </svg>
                </div>
                <p className="text-sm text-[--color-text-muted]">Buy a tier to unlock and stream the full track.</p>
              </div>
            )}
          </div>

          {/* Right: tier purchase */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[--color-text-muted]">
              Get Access
            </h2>
            <TierModal work={work} onUnlocked={(b, t) => { setUnlockedAudio(b); setUnlockedTier(t); }} />
          </div>
        </div>
      </main>
    </>
  );
}
