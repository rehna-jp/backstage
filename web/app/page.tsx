export const dynamic = "force-dynamic"; // always fetch fresh works from chain

import { createPublicClient, http, defineChain } from "viem";
import { NavBar } from "@/components/NavBar";
import { WorkCard } from "@/components/WorkCard";
import { ADDRESSES, REGISTRY_ABI, type Work, type WorkMeta } from "@/lib/contracts";
import { fetchMetadata } from "@/lib/ipfs";

const aeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: { default: { http: ["https://aeneid.storyrpc.io"] } },
});

async function fetchWorks(): Promise<{ id: number; work: Work; meta: WorkMeta | null }[]> {
  const client = createPublicClient({ chain: aeneid, transport: http() });

  const total = await client.readContract({
    address: ADDRESSES.BACKSTAGE_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "totalWorks",
  }) as bigint;

  const count = Number(total);
  if (count === 0) return [];

  const works = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      client.readContract({
        address: ADDRESSES.BACKSTAGE_REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "getWork",
        args: [BigInt(i)],
      }) as Promise<Work>
    )
  );

  const all = works.map((work, i) => ({ id: i, work }));

  // Deduplicate: only keep the most recent registration per ipId
  // (re-runs of publish-work register a new workId for the same IP)
  const seen = new Set<string>();
  const deduped = [...all].reverse().filter(({ work }) => {
    const key = work.ipId.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Only show works that have all 3 vaults (fully set up)
  const valid = deduped.filter(({ work }) => work.gatedVaultUuids.length >= 2);

  const results = await Promise.all(
    valid.map(async ({ id, work }) => {
      let meta: WorkMeta | null = null;
      try {
        const raw = await fetchMetadata(work.metadataURI);
        meta = {
          title:       String(raw.title ?? ""),
          description: String(raw.description ?? ""),
          image:       String(raw.image ?? ""),
        };
      } catch {}
      return { id, work, meta };
    })
  );

  return results;
}

export default async function HomePage() {
  const works = await fetchWorks();

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-6 py-16">

        {/* Hero */}
        <div className="mb-14 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[--color-accent]/30 bg-[--color-accent-glow2] px-3 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[--color-accent] animate-pulse" />
            <span className="text-xs font-medium text-[--color-accent]">Live on Story Aeneid Testnet</span>
          </div>
          <h1
            className="text-5xl font-bold tracking-tight text-[--color-text-primary] leading-[1.1]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Secure your IP.<br />
            <span style={{ background: "linear-gradient(90deg, #3b82f6, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Power your future.
            </span>
          </h1>
          <p className="mt-4 text-lg text-[--color-text-secondary] leading-relaxed">
            Tier-gated music — encrypted on Story, unlocked by license token. Stream, download, or license commercially.
          </p>
        </div>

        {/* Grid */}
        {works.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[--color-border] py-32 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[--color-surface-2] mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--color-text-muted]">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <p className="font-semibold text-[--color-text-secondary]">No works published yet.</p>
            <p className="mt-1 text-sm text-[--color-text-muted]">
              Run <code className="font-mono text-xs bg-[--color-surface-2] px-1.5 py-0.5 rounded">pnpm publish-work</code> to add the first one.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-[--color-text-muted]">
                {works.length} work{works.length !== 1 ? "s" : ""} available
              </p>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {works.map(({ id, work, meta }) => (
                <WorkCard key={id} workId={id} work={work} meta={meta} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
