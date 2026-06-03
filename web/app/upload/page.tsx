"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { cn } from "@/lib/utils";

type UploadStep = "idle" | "uploading" | "done" | "error";
type StepStatus = "pending" | "running" | "done" | "error";

const PIPELINE_STEPS = [
  "Registering IP Asset on Story",
  "Uploading preview to IPFS",
  "Encrypting full track → Stream vault",
  "Encrypting full track → Download vault",
  "Encrypting stems → Commercial vault",
  "Pinning metadata",
  "Registering in Backstage",
];

export default function UploadPage() {
  const { isConnected } = useAccount();

  const [title, setTitle]       = useState("");
  const [description, setDesc]  = useState("");
  const [streamFee, setStream]  = useState("0.01");
  const [downloadFee, setDl]    = useState("0.05");
  const [commFee, setComm]      = useState("0.1");
  const [audioFile, setAudio]   = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep]         = useState<UploadStep>("idle");
  const [stepStatuses, setStatuses] = useState<StepStatus[]>(PIPELINE_STEPS.map(() => "pending"));
  const [errorMsg, setError]    = useState("");
  const [workId, setWorkId]     = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!audioFile || !title.trim()) return;

    setStep("uploading");
    setError("");
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

  if (!isConnected) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-lg px-6 py-32 text-center space-y-5">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-[--color-surface-2]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[--color-text-muted]">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[--color-text-primary]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Connect your wallet
          </h1>
          <p className="text-[--color-text-secondary]">You need a connected wallet to publish work on Backstage.</p>
        </main>
      </>
    );
  }

  if (step === "done" && workId !== null) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-lg px-6 py-32 text-center space-y-5">
          <div
            className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, #22c55e22, #22c55e11)", border: "1px solid #22c55e33" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[--color-text-primary]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {title} is live
          </h1>
          <p className="text-[--color-text-secondary]">
            Encrypted on Story, gated by license tokens, listed in the marketplace.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Link
              href={`/works/${workId}`}
              className="rounded-xl px-6 py-3 font-semibold text-white text-sm transition-all"
              style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", boxShadow: "0 0 16px rgb(59 130 246 / 0.3)" }}
            >
              View your work
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-[--color-border] px-6 py-3 font-semibold text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
            >
              Marketplace
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[--color-text-primary] mb-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Publish a work
          </h1>
          <p className="text-[--color-text-secondary] text-sm">
            Your audio gets encrypted on Story with CDR. Fans pay for a license token to unlock it.
          </p>
        </div>

        <form onSubmit={handlePublish} className="space-y-7">
          {/* File drop */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[--color-text-muted] mb-2">
              Audio file <span className="text-[--color-red] normal-case tracking-normal">*</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInput.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-12 px-8 cursor-pointer transition-all",
                dragging
                  ? "border-[--color-accent] bg-[--color-accent-glow]"
                  : audioFile
                  ? "border-[--color-green]/50 bg-[--color-green]/5"
                  : "border-[--color-border] bg-[--color-surface] hover:border-[--color-accent]/40 hover:bg-[--color-surface-2]"
              )}
            >
              <input ref={fileInput} type="file" accept="audio/*" onChange={onFileChange} className="hidden" />
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition-colors",
                audioFile ? "bg-[--color-green]/15 text-[--color-green]" : "bg-[--color-surface-2] text-[--color-text-muted]"
              )}>
                {audioFile ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                )}
              </div>
              {audioFile ? (
                <>
                  <p className="font-semibold text-[--color-text-primary] text-sm">{audioFile.name}</p>
                  <p className="text-xs text-[--color-text-muted] mt-1">{(audioFile.size / 1e6).toFixed(2)} MB · click to change</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-[--color-text-primary] text-sm">Drop your audio here</p>
                  <p className="text-xs text-[--color-text-muted] mt-1">MP3, WAV, FLAC — any format</p>
                </>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[--color-text-muted] mb-2">
                Title <span className="text-[--color-red] normal-case tracking-normal">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Midnight Demo"
                className="w-full rounded-xl border border-[--color-border] bg-[--color-surface] px-4 py-3 text-sm text-[--color-text-primary] placeholder-[--color-text-muted] focus:border-[--color-accent] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[--color-text-muted] mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="What is this work? What do buyers get?"
                rows={3}
                className="w-full rounded-xl border border-[--color-border] bg-[--color-surface] px-4 py-3 text-sm text-[--color-text-primary] placeholder-[--color-text-muted] focus:border-[--color-accent] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Tier prices */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-[--color-text-muted] mb-3">
              Tier prices (IP token)
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Stream",     icon: "🎧", value: streamFee,   set: setStream, desc: "Listen only" },
                { label: "Download",   icon: "⬇️", value: downloadFee, set: setDl,     desc: "Personal use" },
                { label: "Commercial", icon: "💼", value: commFee,     set: setComm,   desc: "Commercial" },
              ].map(({ label, icon, value, set, desc }) => (
                <div key={label} className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3 hover:border-[--color-accent]/30 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{icon}</span>
                    <span className="text-xs font-semibold text-[--color-text-primary]">{label}</span>
                  </div>
                  <p className="text-[10px] text-[--color-text-muted] mb-2">{desc}</p>
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

          {/* Progress */}
          {step === "uploading" && (
            <div className="rounded-2xl border border-[--color-border] bg-[--color-surface] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[--color-text-muted] mb-4">Publishing…</p>
              <div className="space-y-3">
                {PIPELINE_STEPS.map((label, i) => {
                  const status = stepStatuses[i];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                        status === "done"    ? "bg-[--color-green] text-white" :
                        status === "running" ? "bg-[--color-accent] text-white animate-pulse" :
                        status === "error"   ? "bg-[--color-red] text-white" :
                        "bg-[--color-surface-2] text-[--color-text-muted]"
                      )}>
                        {status === "done" ? "✓" : status === "error" ? "✕" : i + 1}
                      </span>
                      <span className={cn(
                        "text-sm transition-colors",
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
            </div>
          )}

          {step === "error" && (
            <div className="rounded-xl border border-[--color-red]/30 bg-[--color-red]/5 p-4">
              <p className="text-sm font-semibold text-[--color-red] mb-1">Publication failed</p>
              <p className="text-xs text-[--color-red]/70 break-all">{errorMsg}</p>
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
              "w-full rounded-xl py-4 font-semibold text-sm transition-all",
              canSubmit ? "text-white" : "bg-[--color-surface-2] text-[--color-text-muted] cursor-not-allowed"
            )}
            style={canSubmit ? {
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              boxShadow: "0 0 20px rgb(59 130 246 / 0.3)",
            } : undefined}
          >
            {step === "uploading" ? "Publishing…" : "Publish to Story"}
          </button>
        </form>
      </main>
    </>
  );
}
