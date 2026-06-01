import { createPublicClient, http } from "viem";
import { defineChain } from "viem";
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

  const results = await Promise.all(
    works.map(async (work, i) => {
      let meta: WorkMeta | null = null;
      try {
        const raw = await fetchMetadata(work.metadataURI);
        meta = {
          title:       String(raw.title ?? ""),
          description: String(raw.description ?? ""),
          image:       String(raw.image ?? ""),
        };
      } catch {}
      return { id: i, work, meta };
    })
  );

  return results.reverse();
}

export default async function HomePage() {
  const works = await fetchWorks();

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <h1
            className="text-4xl font-bold tracking-tight text-[--color-text-primary]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Unreleased &amp; Exclusive
          </h1>
          <p className="mt-2 text-[--color-text-secondary]">
            Tier-gated IP assets — encrypted on Story, unlocked by license token.
          </p>
        </div>

        {works.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[--color-border] py-24 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 text-[--color-text-muted]">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <p className="text-[--color-text-secondary]">No works published yet.</p>
            <p className="mt-1 text-sm text-[--color-text-muted]">
              Run <code className="font-mono text-xs">pnpm publish-work</code> to add the first one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {works.map(({ id, work, meta }) => (
              <WorkCard key={id} workId={id} work={work} meta={meta} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
