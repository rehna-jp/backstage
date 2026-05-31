export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <h1
        className="text-5xl font-bold mb-4 tracking-tight"
        style={{ fontFamily: "var(--font-space-grotesk)" }}
      >
        Backstage
      </h1>
      <p className="text-neutral-400 max-w-md text-lg">
        Where artists keep their unreleased work — and sell access to it directly.
        <br />
        Encrypted on Story. Gated by license tokens.
      </p>
    </main>
  );
}
