export const dynamic = "force-dynamic";

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

  const seenIp      = new Set<string>();
  const seenCreator = new Set<string>();

  const valid = [...all].reverse()
    .filter(({ work }) => {
      const ip      = work.ipId.toLowerCase();
      const creator = work.creator.toLowerCase();
      if (seenIp.has(ip)) return false;
      seenIp.add(ip);
      if (seenCreator.has(creator)) return false;
      seenCreator.add(creator);
      return work.gatedVaultUuids.length >= 2;
    });

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

      {/* Hero section */}
      <div className="relative overflow-hidden">
        {/* Radial glow blobs */}
        <div
          className="pointer-events-none absolute -top-32 left-1/4 h-[520px] w-[520px] rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #4f8ef7 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        <div
          className="pointer-events-none absolute top-10 right-1/4 h-[360px] w-[360px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #a855f7 0%, transparent 70%)", filter: "blur(80px)" }}
        />

        <main className="relative mx-auto max-w-7xl px-6 pt-20 pb-16">

          {/* Hero */}
          <div className="mb-16 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[--color-accent]/30 bg-[--color-accent-glow2] px-3 py-1.5 mb-7">
              <span className="h-1.5 w-1.5 rounded-full bg-[--color-accent] animate-pulse" />
              <span className="text-xs font-medium text-[--color-accent]">Live on Story Aeneid Testnet</span>
            </div>

            <h1
              className="text-6xl font-bold tracking-tight leading-[1.05] mb-5"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Where artists keep<br />
              <span style={{
                background: "linear-gradient(100deg, #7eb3ff 0%, #4f8ef7 40%, #a855f7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                their unreleased work.
              </span>
            </h1>

            <p className="text-xl text-[--color-text-secondary] leading-relaxed max-w-xl">
              Encrypted on Story. Unlocked by license token. Sell tiered access — stream, download, or license commercially — without ever giving away the file.
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
                Connect your wallet and hit <span className="font-medium text-[--color-text-secondary]">+ Publish</span> to add the first one.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-7">
                <h2
                  className="text-sm font-semibold uppercase tracking-[0.12em] text-[--color-text-muted]"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  New Releases
                </h2>
                <span className="text-xs text-[--color-text-muted] border border-[--color-border] rounded-full px-2.5 py-0.5">
                  {works.length} work{works.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {works.map(({ id, work, meta }) => (
                  <WorkCard key={id} workId={id} work={work} meta={meta} />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-[--color-border-subtle] mt-24 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[--color-text-muted]">
          <span>Built for the CDR Hackathon · Story Foundation 2026</span>
          <div className="flex items-center gap-4">
            <a href="https://story.foundation" target="_blank" rel="noreferrer" className="hover:text-[--color-text-secondary] transition-colors">Story Protocol</a>
            <a href="https://docs.story.foundation/developers/cdr-sdk/overview" target="_blank" rel="noreferrer" className="hover:text-[--color-text-secondary] transition-colors">CDR</a>
          </div>
        </div>
      </footer>
    </>
  );
}
