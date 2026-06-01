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

export function WorkCard({ workId, work, meta }: Props) {
  const cover = meta?.image ? ipfsUrl(meta.image) : null;
  const title = meta?.title ?? `Work #${workId}`;
  const tiers = work.licenseTermsIds.length;

  return (
    <Link
      href={`/works/${workId}`}
      className="group flex flex-col rounded-2xl border border-[--color-border] bg-[--color-surface] overflow-hidden hover:border-[--color-accent]/50 transition-colors"
    >
      <div className="relative aspect-square bg-[--color-surface-2]">
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--color-text-muted]">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 p-4">
        <h3 className="font-semibold truncate text-[--color-text-primary]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          {title}
        </h3>
        <p className="text-xs text-[--color-text-muted]">
          {shortenAddress(work.creator)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-[--color-accent-glow] px-2 py-0.5 text-xs text-[--color-accent]">
            {tiers} {tiers === 1 ? "tier" : "tiers"}
          </span>
          <span className="rounded-full bg-[--color-surface-2] px-2 py-0.5 text-xs text-[--color-text-muted]">
            CDR encrypted
          </span>
        </div>
      </div>
    </Link>
  );
}
