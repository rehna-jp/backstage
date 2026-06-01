"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import Image from "next/image";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TierModal } from "@/components/TierModal";
import { ADDRESSES, REGISTRY_ABI, type Work, type WorkMeta, type TierIndex } from "@/lib/contracts";
import { ipfsUrl, fetchMetadata } from "@/lib/ipfs";
import { shortenAddress } from "@/lib/utils";

export default function WorkPage({ params }: { params: { id: string } }) {
  const workId = BigInt(params.id);
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

  function handleUnlocked(bytes: Uint8Array, tier: TierIndex) {
    setUnlockedAudio(bytes);
    setUnlockedTier(tier);
  }

  if (isLoading) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-4xl px-6 py-16">
          <div className="h-96 animate-pulse rounded-2xl bg-[--color-surface]" />
        </main>
      </>
    );
  }

  if (error || !work) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-[--color-red]">Work not found.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-[--color-accent]">← Back to marketplace</Link>
        </main>
      </>
    );
  }

  const cover = meta?.image ? ipfsUrl(meta.image) : null;
  const title = meta?.title || `Work #${params.id}`;
  const previewUrl = work.previewCID ? ipfsUrl(work.previewCID) : null;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-12 space-y-10">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 2L4 7l5 5"/></svg>
          Marketplace
        </Link>

        {/* Hero */}
        <div className="flex gap-8 flex-col sm:flex-row">
          <div className="relative w-full sm:w-56 aspect-square shrink-0 rounded-2xl overflow-hidden bg-[--color-surface-2]">
            {cover ? (
              <Image src={cover} alt={title} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--color-text-muted]">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div>
              <h1
                className="text-3xl font-bold text-[--color-text-primary] tracking-tight"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                {title}
              </h1>
              <p className="mt-1 text-sm text-[--color-text-muted]">
                by {shortenAddress(work.creator)}
              </p>
              {meta?.description && (
                <p className="mt-3 text-sm text-[--color-text-secondary] leading-relaxed">
                  {meta.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[--color-border] px-3 py-1 text-[--color-text-muted]">
                IP: {shortenAddress(work.ipId)}
              </span>
              <span className="rounded-full bg-[--color-accent-glow] px-3 py-1 text-[--color-accent]">
                CDR encrypted
              </span>
              <a
                href={`https://aeneid.storyscan.xyz/address/${work.ipId}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[--color-border] px-3 py-1 text-[--color-text-muted] hover:text-[--color-accent] transition-colors"
              >
                View on Explorer ↗
              </a>
            </div>
          </div>
        </div>

        {/* Preview player */}
        {previewUrl && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[--color-text-muted]">
              Free Preview
            </h2>
            <AudioPlayer src={previewUrl} label="30-second clip" />
          </section>
        )}

        {/* Unlocked player */}
        {unlockedAudio && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[--color-green]">
              ✓ Full Track Unlocked ({["Stream", "Download", "Commercial"][unlockedTier!]} tier)
            </h2>
            <AudioPlayer src={unlockedAudio} label="Full track — decrypted via CDR" />
          </section>
        )}

        {/* Tier purchase */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[--color-text-muted]">
            Get Access
          </h2>
          <TierModal work={work} onUnlocked={handleUnlocked} />
        </section>
      </main>
    </>
  );
}
