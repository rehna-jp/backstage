"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string | Uint8Array | null;
  label?: string;
};

export function AudioPlayer({ src, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<import("wavesurfer.js").default | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!src || !containerRef.current) return;

    setReady(false);
    setError(null);
    setPlaying(false);

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
        container:    containerRef.current!,
        waveColor:    "#52525b",
        progressColor: "#a855f7",
        cursorColor:  "#a855f7",
        barWidth:     2,
        barGap:       1,
        barRadius:    2,
        height:       56,
        normalize:    true,
        url,
      });

      ws.on("ready", () => setReady(true));
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

  return (
    <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
      {label && (
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[--color-text-muted]">
          {label}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          disabled={!ready}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[--color-accent] text-white disabled:opacity-40 transition-opacity hover:bg-[--color-accent-dim]"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="4" height="12" rx="1" />
              <rect x="8" y="1" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3 1.5l10 5.5-10 5.5V1.5z" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {error ? (
            <p className="text-xs text-[--color-red]">{error}</p>
          ) : !ready ? (
            <div className="h-14 animate-pulse rounded bg-[--color-surface-2]" />
          ) : null}
          <div ref={containerRef} className={ready ? "" : "hidden"} />
        </div>
      </div>
    </div>
  );
}
