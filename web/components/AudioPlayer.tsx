"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string | Uint8Array | null;
  label?: string;
  unlocked?: boolean;
};

export function AudioPlayer({ src, label, unlocked }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<import("wavesurfer.js").default | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!src || !containerRef.current) return;

    setReady(false);
    setError(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    let url: string;
    if (src instanceof Uint8Array) {
      const blob = new Blob([src.buffer as ArrayBuffer], { type: "audio/mpeg" });
      url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
    } else {
      url = src;
    }

    import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      wsRef.current?.destroy();
      const ws = WaveSurfer.create({
        container:     containerRef.current!,
        waveColor:     "#252538",
        progressColor: "#3b82f6",
        cursorColor:   "#60a5fa",
        barWidth:      2,
        barGap:        1,
        barRadius:     3,
        height:        48,
        normalize:     true,
        url,
      });

      ws.on("ready", () => {
        setReady(true);
        setDuration(ws.getDuration());
      });
      ws.on("audioprocess", () => setCurrentTime(ws.getCurrentTime()));
      ws.on("seek", () => setCurrentTime(ws.getCurrentTime()));
      ws.on("finish", () => setPlaying(false));
      ws.on("error", (e) => setError(String(e)));

      wsRef.current = ws;
    });

    return () => {
      wsRef.current?.destroy();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src]);

  function toggle() {
    if (!wsRef.current || !ready) return;
    if (playing) {
      wsRef.current.pause();
      setPlaying(false);
    } else {
      wsRef.current.play();
      setPlaying(true);
    }
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div
      className="rounded-2xl border border-[--color-border] p-5 transition-all"
      style={{
        background: unlocked
          ? "linear-gradient(135deg, rgb(59 130 246 / 0.08), rgb(59 130 246 / 0.03))"
          : "var(--color-surface)",
        borderColor: unlocked ? "rgb(59 130 246 / 0.3)" : undefined,
      }}
    >
      {label && (
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[--color-text-muted]">
          {label}
        </p>
      )}

      <div className="flex items-center gap-4">
        {/* Play button */}
        <button
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all disabled:opacity-30"
          style={ready ? {
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            boxShadow: playing ? "0 0 20px rgb(59 130 246 / 0.5)" : "0 0 12px rgb(59 130 246 / 0.25)",
          } : { background: "var(--color-surface-3)" }}
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <rect x="1.5" y="1" width="3.5" height="11" rx="1" />
              <rect x="8" y="1" width="3.5" height="11" rx="1" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
              <path d="M2.5 1.5l9 5-9 5V1.5z" />
            </svg>
          )}
        </button>

        {/* Waveform + time */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {error ? (
            <p className="text-xs text-[--color-red]">{error}</p>
          ) : !ready ? (
            <div className="h-12 animate-pulse rounded-lg bg-[--color-surface-2]" />
          ) : null}
          <div ref={containerRef} className={ready ? "" : "hidden"} />
          {ready && (
            <div className="flex justify-between text-[10px] text-[--color-text-muted] tabular-nums">
              <span>{fmt(currentTime)}</span>
              <span>{fmt(duration)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
