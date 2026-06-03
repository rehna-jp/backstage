"use client";

import Link from "next/link";
import Image from "next/image";
import { type Work, type WorkMeta } from "@/lib/contracts";
import { ipfsUrl } from "@/lib/ipfs";
import { shortenAddress } from "@/lib/utils";

type Props = {
  workId: number;
  work: Work;
  meta: WorkMeta | null;
};

const TIER_ICONS = ["🎧", "⬇️", "💼"];

export function WorkCard({ workId, work, meta }: Props) {
  const cover = meta?.image ? ipfsUrl(meta.image) : null;
  const title = meta?.title ?? `Work #${workId}`;
  const tiers = Math.min(work.licenseTermsIds.length, 3);

  return (
    <Link
      href={`/works/${workId}`}
      className="group flex flex-col rounded-2xl overflow-hidden border border-[--color-border] bg-[--color-surface] hover:border-[--color-accent]/40 hover:bg-[--color-surface-2] transition-all duration-300"
      style={{ boxShadow: "0 2px 12px rgb(0 0 0 / 0.4)" }}
    >
      {/* Cover */}
      <div className="relative aspect-square bg-[--color-surface-2] overflow-hidden">
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[--color-surface-2] to-[--color-surface-3]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[--color-text-muted]">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {/* CDR lock badge */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 border border-white/10">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-[--color-accent]">
            <path d="M12 2a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3z"/>
          </svg>
          <span className="text-[10px] font-medium text-white/80">CDR</span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 p-4">
        <div>
          <h3
            className="font-semibold text-sm text-[--color-text-primary] truncate group-hover:text-[--color-accent-bright] transition-colors"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            {title}
          </h3>
          <p className="text-xs text-[--color-text-muted] mt-0.5">
            {shortenAddress(work.creator)}
          </p>
        </div>

        {/* Tier icons */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1">
            {Array.from({ length: tiers }).map((_, i) => (
              <span
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-[--color-surface-3] text-[10px] border border-[--color-border]"
                title={["Stream", "Download", "Commercial"][i]}
              >
                {TIER_ICONS[i]}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-medium text-[--color-accent] bg-[--color-accent-glow2] border border-[--color-accent]/20 px-2 py-0.5 rounded-full">
            {tiers} tier{tiers !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
