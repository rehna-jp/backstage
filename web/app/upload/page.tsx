"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { cn } from "@/lib/utils";

type UploadStep =
  | "idle"
  | "uploading"   // sending to API
  | "done"
  | "error";

type StepStatus = "pending" | "running" | "done" | "error";

const PIPELINE_STEPS = [
  "Registering IP Asset on Story",
  "Uploading preview to IPFS",
  "Encrypting full track → CDR vault",
  "Encrypting stems → CDR vault",
  "Pinning metadata",
  "Registering in Backstage",
];

export default function UploadPage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  const [title, setTitle]       = useState("");
  const [description, setDesc]  = useState("");
  const [streamFee, setStream]  = useState("0.01");
  const [downloadFee, setDl]    = useState("0.05");
  const [commFee, setComm]      = useState("0.1");
  const [audioFile, setAudio]   = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep]         = useState<UploadStep>("idle");
  const [stepStatuses, setStatuses] = useState<StepStatus[]>(
    PIPELINE_STEPS.map(() => "pending")
  );
  const [errorMsg, setError]    = useState("");
  const [workId, setWorkId]     = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // ── Drag-drop ────────────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) setAudio(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAudio(file);
  };

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!audioFile || !title.trim()) return;

    setStep("uploading");
    setError("");
    // Animate steps running one by one (optimistic)
    const animate = async () => {
      for (let i = 0; i < PIPELINE_STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 0));
        setStatuses((prev) => {
          const next = [...prev];
          if (i > 0) next[i - 1] = "done";
          next[i] = "running";
          return next;
        });
        await new Promise((r) => setTimeout(r, 4000 + i * 2000));
      }
    };
    animate();

    const form = new FormData();
    form.append("title", title.trim());
    form.append("description", description.trim());
    form.append("streamFee", streamFee);
    form.append("downloadFee", downloadFee);
    form.append("commFee", commFee);
    form.append("audio", audioFile);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload failed.");

      setStatuses(PIPELINE_STEPS.map(() => "done"));
      setWorkId(data.workId);
      setStep("done");
    } catch (err) {
      setStatuses((prev) => prev.map((s) => (s === "running" ? "error" : s)));
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  const canSubmit = !!audioFile && title.trim().length > 0 && step === "idle";

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="text-3xl font-bold text-[--color-text-primary] mb-4">Connect your wallet</h1>
          <p className="text-[--color-text-secondary]">You need a connected wallet to publish work on Backstage.</p>
        </main>
      </>
    );
  }

  if (step === "done" && workId !== null) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="text-5xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-[--color-text-primary] mb-2">{title} is live</h1>
          <p className="text-[--color-text-secondary] mb-8">
            Your work is encrypted on Story, gated by license tokens, and listed in the marketplace.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href={`/works/${workId}`}
              className="rounded-xl bg-[--color-accent] px-6 py-3 font-semibold text-white hover:bg-[--color-accent-dim] transition-colors"
            >
              View your work
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-[--color-border] px-6 py-3 font-semibold text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
            >
              Back to marketplace
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[--color-text-primary] mb-2">Publish a work</h1>
          <p className="text-[--color-text-secondary]">
            Your audio gets encrypted on Story with CDR. Fans pay for a license token to unlock it.
          </p>
        </div>

        <form onSubmit={handlePublish} className="space-y-8">
          {/* ── File drop ─────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-[--color-text-secondary] mb-2">
              Audio file <span className="text-[--color-red]">*</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInput.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors",
                dragging
                  ? "border-[--color-accent] bg-[--color-accent-glow]"
                  : audioFile
                  ? "border-[--color-green] bg-[--color-surface]"
                  : "border-[--color-border] bg-[--color-surface] hover:border-[--color-accent]/60"
              )}
            >
              <input
                ref={fileInput}
                type="file"
                accept="audio/*"
                onChange={onFileChange}
                className="hidden"
              />
              {audioFile ? (
                <>
                  <div className="text-3xl mb-2">🎵</div>
                  <p className="font-semibold text-[--color-text-primary]">{audioFile.name}</p>
                  <p className="text-sm text-[--color-text-secondary] mt-1">
                    {(audioFile.size / 1e6).toFixed(2)} MB — click to change
                  </p>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-2">🎵</div>
                  <p className="font-semibold text-[--color-text-primary]">Drop your audio here</p>
                  <p className="text-sm text-[--color-text-secondary] mt-1">MP3, WAV, FLAC — any audio format</p>
                </>
              )}
            </div>
          </div>

          {/* ── Metadata ──────────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--color-text-secondary] mb-1">
                Title <span className="text-[--color-red]">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midnight Demo"
                className="w-full rounded-xl border border-[--color-border] bg-[--color-surface] px-4 py-3 text-[--color-text-primary] placeholder-[--color-text-muted] focus:border-[--color-accent] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--color-text-secondary] mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What is this work? What do buyers get?"
                rows={3}
                className="w-full rounded-xl border border-[--color-border] bg-[--color-surface] px-4 py-3 text-[--color-text-primary] placeholder-[--color-text-muted] focus:border-[--color-accent] focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* ── Tier prices ───────────────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-[--color-text-secondary] uppercase tracking-wider mb-3">
              Tier prices (IP token)
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Stream",     icon: "🎧", value: streamFee,   set: setStream,  desc: "Listen only" },
                { label: "Download",   icon: "⬇️", value: downloadFee, set: setDl,      desc: "Personal use" },
                { label: "Commercial", icon: "💼", value: commFee,     set: setComm,    desc: "Commercial rights" },
              ].map(({ label, icon, value, set, desc }) => (
                <div key={label} className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{icon}</span>
                    <span className="text-sm font-semibold text-[--color-text-primary]">{label}</span>
                  </div>
                  <p className="text-xs text-[--color-text-muted] mb-2">{desc}</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      min="0"
                      step="0.001"
                      className="w-full rounded-lg border border-[--color-border] bg-[--color-surface-2] px-2 py-1.5 text-sm text-[--color-text-primary] focus:border-[--color-accent] focus:outline-none"
                    />
                    <span className="text-xs text-[--color-text-muted] shrink-0">IP</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Progress / Submit ─────────────────────────────────────────── */}
          {step === "uploading" && (
            <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5 space-y-2">
              <p className="text-sm font-semibold text-[--color-text-secondary] mb-3">Publishing…</p>
              {PIPELINE_STEPS.map((label, i) => {
                const status = stepStatuses[i];
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      status === "done"    ? "bg-[--color-green] text-white" :
                      status === "running" ? "bg-[--color-accent] text-white animate-pulse" :
                      status === "error"   ? "bg-[--color-red] text-white" :
                      "bg-[--color-surface-2] text-[--color-text-muted]"
                    )}>
                      {status === "done" ? "✓" : status === "error" ? "✕" : i + 1}
                    </span>
                    <span className={cn(
                      "text-sm",
                      status === "running" ? "text-[--color-text-primary] font-medium" :
                      status === "done"    ? "text-[--color-text-muted] line-through" :
                      "text-[--color-text-muted]"
                    )}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {step === "error" && (
            <div className="rounded-xl border border-[--color-red]/40 bg-[--color-red]/10 p-4">
              <p className="text-sm font-semibold text-[--color-red] mb-1">Publication failed</p>
              <p className="text-xs text-[--color-red]/80 break-all">{errorMsg}</p>
              <button
                type="button"
                onClick={() => setStep("idle")}
                className="mt-3 text-xs text-[--color-accent] hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "w-full rounded-xl py-4 font-semibold text-base transition-all",
              canSubmit
                ? "bg-[--color-accent] text-white hover:bg-[--color-accent-dim]"
                : "bg-[--color-surface-2] text-[--color-text-muted] cursor-not-allowed"
            )}
          >
            {step === "uploading" ? "Publishing…" : "Publish to Story"}
          </button>
        </form>
      </main>
    </>
  );
}
