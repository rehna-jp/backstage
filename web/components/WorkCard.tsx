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

const TIER_LABELS = ["Stream", "Download", "Commercial"];
const TIER_COLORS = ["#4f8ef7", "#a855f7", "#22c55e"];

export function WorkCard({ workId, work, meta }: Props) {
  const cover = meta?.image ? ipfsUrl(meta.image) : null;
  const title = meta?.title ?? `Work #${workId}`;
  const tiers = Math.min(work.licenseTermsIds.length, 3);

  return (
    <Link
      href={`/works/${workId}`}
      className="group flex flex-col rounded-2xl overflow-hidden border border-[--color-border] bg-[--color-surface] hover:border-[--color-accent]/50 transition-all duration-300"
      style={{ boxShadow: "0 2px 16px rgb(0 0 0 / 0.5)" }}
    >
      {/* Cover */}
      <div className="relative aspect-square overflow-hidden">
        {cover ? (
          <>
            <Image
              src={cover}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              unoptimized
            />
            {/* Bottom gradient for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </>
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #141428 0%, #1a1232 50%, #0e1a30 100%)",
            }}
          >
            {/* Abstract waveform placeholder */}
            <svg width="56" height="40" viewBox="0 0 56 40" fill="none">
              {[4, 8, 16, 24, 20, 32, 24, 16, 8, 4].map((h, i) => (
                <rect
                  key={i}
                  x={i * 5.5 + 1}
                  y={(40 - h) / 2}
                  width="3.5"
                  height={h}
                  rx="2"
                  fill={`rgb(79 142 247 / ${0.2 + (i % 3) * 0.12})`}
                />
              ))}
            </svg>
          </div>
        )}

        {/* CDR lock badge */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 border border-white/10">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="text-[--color-accent]">
            <path d="M12 2a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3z"/>
          </svg>
          <span className="text-[10px] font-medium text-white/80">CDR</span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-[--color-accent]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Info */}
      <div className="flex flex-col gap-3 p-3.5">
        <div>
          <h3
            className="font-semibold text-sm text-[--color-text-primary] truncate group-hover:text-[--color-accent-bright] transition-colors"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            {title}
          </h3>
          <p className="text-[11px] text-[--color-text-muted] mt-0.5 font-mono">
            {shortenAddress(work.creator)}
          </p>
        </div>

        {/* Tier dots */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: tiers }).map((_, i) => (
              <div
                key={i}
                className="flex h-5 w-5 items-center justify-center rounded-full border text-[9px]"
                style={{
                  borderColor: `${TIER_COLORS[i]}40`,
                  background: `${TIER_COLORS[i]}12`,
                  color: TIER_COLORS[i],
                }}
                title={TIER_LABELS[i]}
              >
                {["♫", "↓", "©"][i]}
              </div>
            ))}
          </div>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: "rgb(79 142 247 / 0.08)",
              color: "var(--color-accent-bright)",
              border: "1px solid rgb(79 142 247 / 0.2)",
            }}
          >
            {tiers} tiers
          </span>
        </div>
      </div>
    </Link>
  );
}
